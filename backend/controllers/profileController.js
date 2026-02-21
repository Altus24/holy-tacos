// Controlador de perfiles para Holy Tacos
// Maneja las operaciones CRUD de perfiles de usuario
const User = require('../models/User');
const { getFileUrl } = require('../middleware/upload');

// Obtener perfil completo del usuario autenticado
const getProfile = async (req, res) => {
  try {
    // Buscar usuario con populate de restaurantes favoritos si es cliente
    const populateOptions = [];
    if (req.user.role === 'client') {
      populateOptions.push({
        path: 'clientProfile.favoriteRestaurants',
        select: 'name address rating'
      });
    }

    const user = await User.findById(req.user._id).populate(populateOptions);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      data: user
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil'
    });
  }
};

// Actualizar perfil del usuario autenticado
const updateProfile = async (req, res) => {
  try {
    const { name, phone, email, ...profileData } = req.body;

    const updateData = {
      name,
      phone,
      updatedAt: Date.now()
    };

    if (email !== undefined && typeof email === 'string') {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail) {
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing && existing._id.toString() !== req.user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Ese correo ya está en uso por otra cuenta'
          });
        }
        updateData.email = normalizedEmail;
      }
    }

    // Actualizar campos específicos según el rol
    if (req.user.role === 'client') {
      // Para clientes, actualizar clientProfile
      if (profileData.clientProfile) {
        updateData.clientProfile = profileData.clientProfile;
      }
    } else if (req.user.role === 'driver') {
      // Para conductores: actualizar SOLO los campos editables por el driver.
      // NUNCA reemplazar driverProfile entero: se perderían verificationStatus, verificationHistory, etc. (seteados por admin).
      if (profileData.driverProfile) {
        const dp = profileData.driverProfile;
        if (dp.vehicle != null) updateData['driverProfile.vehicle'] = dp.vehicle;
        if (dp.licenseNumber != null) updateData['driverProfile.licenseNumber'] = dp.licenseNumber;
        if (dp.licenseExpiration != null) updateData['driverProfile.licenseExpiration'] = dp.licenseExpiration;
        if (dp.documents != null) updateData['driverProfile.documents'] = dp.documents;
        if (dp.workingAreas != null) updateData['driverProfile.workingAreas'] = dp.workingAreas;
        // isAvailable solo se cambia por el toggle de disponibilidad o por admin; no se actualiza desde el formulario de perfil.
      }
    }

    // Actualizar el usuario
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate(req.user.role === 'client' ? 'clientProfile.favoriteRestaurants' : []);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: updatedUser
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);

    // Manejar errores de validación
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar el perfil'
    });
  }
};

// Subir foto de perfil
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }

    // Generar URL del archivo
    const fileUrl = getFileUrl(req.file.filename);

    // Actualizar la foto de perfil del usuario
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        profilePicture: fileUrl,
        updatedAt: Date.now()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Foto de perfil subida exitosamente',
      data: {
        profilePicture: fileUrl,
        filename: req.file.filename
      }
    });

  } catch (error) {
    console.error('Error al subir foto de perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir la foto de perfil'
    });
  }
};

// Subir documentos del conductor
const uploadDriverDocuments = async (req, res) => {
  try {
    // Verificar que el usuario sea conductor
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Solo los conductores pueden subir documentos'
      });
    }

    const uploadedFiles = {};

    // Procesar archivos subidos
    if (req.files) {
      if (req.files.licenseFront && req.files.licenseFront[0]) {
        uploadedFiles.licenseFront = getFileUrl(req.files.licenseFront[0].filename);
      }

      if (req.files.licenseBack && req.files.licenseBack[0]) {
        uploadedFiles.licenseBack = getFileUrl(req.files.licenseBack[0].filename);
      }

      if (req.files.profileVerification && req.files.profileVerification[0]) {
        uploadedFiles.profileVerification = getFileUrl(req.files.profileVerification[0].filename);
      }
    }

    // Obtener el usuario actual para preservar documentos existentes
    const currentUser = await User.findById(req.user._id);

    // Fusionar documentos existentes con los nuevos (los nuevos reemplazan los existentes)
    const existingDocuments = currentUser.driverProfile?.documents || {};
    const mergedDocuments = {
      ...existingDocuments,
      ...uploadedFiles
    };

    // Actualizar documentos del conductor (preservando existentes)
    const updateData = {
      'driverProfile.documents': mergedDocuments,
      updatedAt: Date.now()
    };

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Documentos subidos exitosamente',
      data: {
        documents: mergedDocuments
      }
    });

  } catch (error) {
    console.error('Error al subir documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir los documentos'
    });
  }
};

// Cambiar disponibilidad del conductor
const toggleDriverAvailability = async (req, res) => {
  try {
    // Verificar que el usuario sea conductor
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Solo los conductores pueden cambiar su disponibilidad'
      });
    }

    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'El campo isAvailable debe ser un booleano'
      });
    }

    // REGLA ESTRICTA: No se puede activar si la verificación no está aprobada
    if (isAvailable) {
      const currentUser = await User.findById(req.user._id);
      if (currentUser?.driverProfile?.verificationStatus !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'No podés activar tu disponibilidad hasta que tu verificación sea aprobada por el administrador.'
        });
      }
    }

    // Actualizar disponibilidad del conductor
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        'driverProfile.isAvailable': isAvailable,
        updatedAt: Date.now()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Disponibilidad ${isAvailable ? 'activada' : 'desactivada'} exitosamente`,
      data: {
        isAvailable: updatedUser.driverProfile.isAvailable
      }
    });

  } catch (error) {
    console.error('Error al cambiar disponibilidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar la disponibilidad'
    });
  }
};

// Actualizar ubicación del conductor
const updateDriverLocation = async (req, res) => {
  try {
    // Verificar que el usuario sea conductor
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Solo los conductores pueden actualizar su ubicación'
      });
    }

    const { lat, lng } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas inválidas'
      });
    }

    // Actualizar ubicación del conductor
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        'driverProfile.currentLocation': {
          lat,
          lng,
          updatedAt: Date.now()
        },
        updatedAt: Date.now()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Ubicación actualizada exitosamente',
      data: {
        currentLocation: updatedUser.driverProfile.currentLocation
      }
    });

  } catch (error) {
    console.error('Error al actualizar ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la ubicación'
    });
  }
};

// Activar/desactivar compartir ubicación en tiempo real
const toggleLocationSharing = async (req, res) => {
  try {
    // Verificar que el usuario sea conductor
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Solo los conductores pueden cambiar esta configuración'
      });
    }

    const { shareLocation } = req.body;

    if (typeof shareLocation !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'El campo shareLocation debe ser un booleano'
      });
    }

    // Preparar datos de actualización
    const updateData = {
      'driverProfile.shareLocation': shareLocation,
      updatedAt: Date.now()
    };

    // Si se activa, registrar la fecha
    if (shareLocation) {
      updateData['driverProfile.lastLocationShared'] = Date.now();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Compartir ubicación ${shareLocation ? 'activado' : 'desactivado'} exitosamente`,
      data: {
        shareLocation: updatedUser.driverProfile.shareLocation,
        lastLocationShared: updatedUser.driverProfile.lastLocationShared
      }
    });

  } catch (error) {
    console.error('Error al cambiar compartir ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar la configuración de ubicación'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  uploadDriverDocuments,
  toggleDriverAvailability,
  updateDriverLocation,
  toggleLocationSharing
};