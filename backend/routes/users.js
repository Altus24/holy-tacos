// Rutas para gestión de usuarios en Holy Tacos
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { authenticateToken, requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - Obtener lista de usuarios (solo para administradores)
// Incluye name y driverProfile para que el admin pueda asignar conductores en órdenes
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de usuarios'
    });
  }
});

// POST /api/users/register - Registrar un nuevo usuario
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validar datos requeridos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios'
      });
    }

    // Verificar si el usuario ya existe
    const usuarioExistente = await User.findOne({ email: email.toLowerCase() });
    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear el usuario
    const nuevoUsuario = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'client' // Por defecto es cliente
    });

    const usuarioGuardado = await nuevoUsuario.save();

    // No devolver la contraseña en la respuesta
    const usuarioRespuesta = {
      _id: usuarioGuardado._id,
      email: usuarioGuardado.email,
      role: usuarioGuardado.role,
      createdAt: usuarioGuardado.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: usuarioRespuesta
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);

    // Manejar errores de validación
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al registrar el usuario'
    });
  }
});

// POST /api/users/login - Iniciar sesión
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar datos requeridos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios'
      });
    }

    // Buscar el usuario
    const usuario = await User.findOne({ email: email.toLowerCase() });
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar la contraseña
    const contraseñaValida = await bcrypt.compare(password, usuario.password);
    if (!contraseñaValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Usuario autenticado exitosamente
    const usuarioRespuesta = {
      _id: usuario._id,
      email: usuario.email,
      role: usuario.role,
      createdAt: usuario.createdAt
    };

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: usuarioRespuesta
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
});

// GET /api/users/profile - Obtener perfil del usuario (requiere autenticación)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // El usuario ya está autenticado y su información está en req.user
    const usuario = await User.findById(req.user._id).select('-password');

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: usuario
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil'
    });
  }
});

// PUT /api/users/:id - Actualizar usuario (solo para administradores o el propio usuario)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { email, role } = req.body;

    // Verificar permisos: admin puede actualizar cualquier usuario, usuario normal solo su propio perfil
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar este usuario'
      });
    }

    // Solo permitir que los usuarios cambien su email, no su rol (solo admin puede cambiar roles)
    const updateData = { updatedAt: Date.now() };
    if (email) updateData.email = email;
    if (req.user.role === 'admin' && role) updateData.role = role;

    const usuario = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: usuario
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el usuario'
    });
  }
});

// DELETE /api/users/:id - Eliminar usuario (solo para administradores)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usuario = await User.findByIdAndDelete(req.params.id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el usuario'
    });
  }
});

module.exports = router;