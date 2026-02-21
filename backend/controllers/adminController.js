// Controlador para operaciones de administración en Holy Tacos
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');

// Obtener estadísticas del dashboard
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalRestaurants,
      totalUsers,
      totalOrders,
      activeOrders,
      pendingOrders,
      activeDrivers,
      approvedDrivers,
      pendingVerificationDrivers
    ] = await Promise.all([
      Restaurant.countDocuments({ isActive: true }),
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ paymentStatus: 'paid', status: { $in: ['assigned', 'heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way'] } }),
      Order.countDocuments({ paymentStatus: 'paid', status: 'pending', driverId: null }),
      // Activos = aprobados y con isActive !== false (mismo criterio que GET /drivers/counts)
      User.countDocuments({
        role: 'driver',
        'driverProfile.verificationStatus': 'approved',
        'driverProfile.isActive': { $ne: false }
      }),
      User.countDocuments({ role: 'driver', 'driverProfile.verificationStatus': 'approved' }),
      User.countDocuments({ role: 'driver', 'driverProfile.verificationStatus': 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        totalRestaurants,
        totalUsers,
        totalOrders,
        activeOrders,
        pendingOrders,
        activeDrivers,
        verifiedDrivers: approvedDrivers,
        pendingVerificationDrivers
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del dashboard'
    });
  }
};

// Gestión de Drivers

// Conteos para el dashboard de drivers: total, activos, disponibles, por estado de verificación
const getDriverCounts = async (req, res) => {
  try {
    const [total, active, availableNow, pending, approved, rejected] = await Promise.all([
      User.countDocuments({ role: 'driver' }),
      User.countDocuments({
        role: 'driver',
        'driverProfile.verificationStatus': 'approved',
        'driverProfile.isActive': { $ne: false }
      }),
      User.countDocuments({
        role: 'driver',
        'driverProfile.verificationStatus': 'approved',
        'driverProfile.isAvailable': true
      }),
      User.countDocuments({ role: 'driver', 'driverProfile.verificationStatus': 'pending' }),
      User.countDocuments({ role: 'driver', 'driverProfile.verificationStatus': 'approved' }),
      User.countDocuments({ role: 'driver', 'driverProfile.verificationStatus': 'rejected' })
    ]);

    res.json({
      success: true,
      data: { total, active, availableNow, pending, approved, rejected }
    });
  } catch (error) {
    console.error('Error obteniendo conteos de drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener conteos de drivers'
    });
  }
};

// Listar drivers con filtro por estado. ?status=all|pending|approved|rejected
// "all" = solo approved + pending (excluye rechazados; los rechazados solo en pestaña Rechazados)
const getAllDrivers = async (req, res) => {
  try {
    const status = (req.query.status || 'all').toLowerCase();
    const baseFilter = { role: 'driver' };
    const validStatuses = ['all', 'pending', 'approved', 'rejected'];
    const statusFilter = validStatuses.includes(status) ? status : 'all';

    if (statusFilter === 'all') {
      // Todos = solo aprobados y pendientes; excluir rechazados
      baseFilter['driverProfile.verificationStatus'] = { $in: ['approved', 'pending'] };
    } else {
      baseFilter['driverProfile.verificationStatus'] = statusFilter;
    }

    const drivers = await User.find(baseFilter)
      .select('-password')
      .sort({ createdAt: -1 });

    // Asegurar que en la respuesta todos tengan isActive definido (para compatibilidad frontend)
    const driversWithStatus = drivers.map(driver => {
      const d = driver.toObject ? driver.toObject() : { ...driver };
      if (d.driverProfile && d.driverProfile.isActive === undefined) {
        d.driverProfile = d.driverProfile || {};
        d.driverProfile.isActive = true;
      }
      return d;
    });

    res.json({
      success: true,
      count: driversWithStatus.length,
      data: driversWithStatus
    });
  } catch (error) {
    console.error('Error obteniendo drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de drivers'
    });
  }
};

const getDriverById = async (req, res) => {
  try {
    const driver = await User.findById(req.params.id).select('-password');

    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver no encontrado'
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Error obteniendo detalles del driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del driver'
    });
  }
};

// Cambiar estado de verificación del driver (sistema granular)
// Acepta: { status: 'approved' | 'rejected' | 'pending', notes: String }
const verifyDriver = async (req, res) => {
  try {
    const { status, notes } = req.body;

    // Validar que el estado sea válido
    const estadosValidos = ['approved', 'rejected', 'pending'];
    if (!status || !estadosValidos.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Estado de verificación no válido. Debe ser: ${estadosValidos.join(', ')}`
      });
    }

    // Si se rechaza, las notas/motivo son obligatorias
    if (status === 'rejected' && (!notes || notes.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Debés indicar el motivo del rechazo.'
      });
    }

    // Buscar el driver
    const driver = await User.findById(req.params.id);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver no encontrado'
      });
    }

    // Determinar la acción para el historial
    let action = status; // 'approved', 'rejected'
    if (status === 'pending' && driver.driverProfile?.verificationStatus === 'approved') {
      action = 'revoked'; // Revocar verificación aprobada
    } else if (status === 'pending') {
      action = 'submitted'; // Volver a pending (reset)
    }

    // Construir datos de actualización
    const updateData = {
      'driverProfile.verificationStatus': status,
      'driverProfile.verificationNotes': notes || '',
      'driverProfile.verifiedAt': (status === 'approved' || status === 'rejected') ? Date.now() : null,
      'driverProfile.isVerified': status === 'approved', // Mantener compatibilidad
      updatedAt: Date.now()
    };

    // REGLA ESTRICTA: Si no está approved, forzar isAvailable = false
    if (status !== 'approved') {
      updateData['driverProfile.isAvailable'] = false;
    }

    // Agregar entrada al historial de verificación
    const historyEntry = {
      action,
      by: req.user._id,
      date: new Date(),
      notes: notes || ''
    };

    const updatedDriver = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: updateData,
        $push: { 'driverProfile.verificationHistory': historyEntry }
      },
      { new: true, runValidators: true }
    ).select('-password');

    // Emitir evento Socket.io al driver específico para notificarlo
    const io = req.app.get('io');
    if (io) {
      // Buscar el socket del driver por su userId
      const sockets = await io.fetchSockets();
      const driverSocket = sockets.find(s => s.userId === req.params.id);
      if (driverSocket) {
        driverSocket.emit('verificationUpdate', {
          status,
          notes: notes || '',
          action
        });
        console.log(`[SOCKET] Notificación de verificación enviada al driver ${req.params.id}`);
      }
    }

    // Mensaje según la acción
    const mensajes = {
      approved: `Driver aprobado exitosamente. Ahora puede activarse y recibir pedidos.`,
      rejected: `Driver rechazado. Motivo: ${notes}`,
      revoked: `Verificación revocada. El driver fue desactivado automáticamente.`,
      submitted: `Driver restablecido a estado pendiente de verificación.`
    };

    console.log(`[ADMIN] Verificación del driver ${req.params.id} cambiada a '${status}' por admin ${req.user._id}`);

    res.json({
      success: true,
      message: mensajes[action] || `Estado de verificación actualizado a '${status}'`,
      data: updatedDriver
    });
  } catch (error) {
    console.error('Error cambiando verificación del driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado de verificación'
    });
  }
};

// Cambiar disponibilidad del driver
// REGLA ESTRICTA: Solo se puede activar (isAvailable=true) si verificationStatus === 'approved'
const toggleDriverAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    // Buscar el driver primero para validar
    const driver = await User.findById(req.params.id);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver no encontrado'
      });
    }

    // REGLA: No se puede activar un driver que no esté aprobado
    if (isAvailable && driver.driverProfile?.verificationStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'No se puede activar un driver que no tiene la verificación aprobada. Primero aprobá su verificación.'
      });
    }

    const updatedDriver = await User.findByIdAndUpdate(
      req.params.id,
      {
        'driverProfile.isAvailable': isAvailable,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: `Driver ${isAvailable ? 'marcado como disponible' : 'marcado como no disponible'} exitosamente`,
      data: updatedDriver
    });
  } catch (error) {
    console.error('Error cambiando disponibilidad del driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar disponibilidad'
    });
  }
};

const toggleDriverStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const driver = await User.findByIdAndUpdate(
      req.params.id,
      {
        'driverProfile.isActive': isActive,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver no encontrado'
      });
    }

    res.json({
      success: true,
      message: `Driver ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      data: driver
    });
  } catch (error) {
    console.error('Error cambiando estado del driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado'
    });
  }
};

const deleteDriver = async (req, res) => {
  try {
    const driver = await User.findById(req.params.id);

    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver no encontrado'
      });
    }

    // Solo permitir eliminar si está inactivo
    if (driver.driverProfile?.isActive !== false) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar drivers inactivos. Primero desactívalo.'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Driver eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar driver'
    });
  }
};

const updateDriverProfile = async (req, res) => {
  try {
    const updateData = req.body;

    // Remover campos que no deberían actualizarse directamente
    delete updateData._id;
    delete updateData.email;
    delete updateData.role;
    delete updateData.password;

    const driver = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...updateData,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Perfil del driver actualizado exitosamente',
      data: driver
    });
  } catch (error) {
    console.error('Error actualizando perfil del driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil del driver'
    });
  }
};

// Gestión de Restaurantes

const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({})
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error('Error obteniendo restaurantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de restaurantes'
    });
  }
};

const createRestaurant = async (req, res) => {
  try {
    const { location, ...restData } = req.body;

    // Construir datos del restaurante
    const restaurantData = { ...restData };

    // Si vienen coordenadas (lat, lng), convertir a formato GeoJSON [lng, lat]
    if (location && location.lat != null && location.lng != null) {
      restaurantData.location = {
        type: 'Point',
        coordinates: [parseFloat(location.lng), parseFloat(location.lat)]
      };
    }

    const restaurant = new Restaurant(restaurantData);
    const nuevoRestaurant = await restaurant.save();

    res.status(201).json({
      success: true,
      message: 'Restaurante creado exitosamente',
      data: nuevoRestaurant
    });
  } catch (error) {
    console.error('Error creando restaurante:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear restaurante'
    });
  }
};

const updateRestaurant = async (req, res) => {
  try {
    const { isActive, location, ...otherData } = req.body;
    const updateData = {
      ...otherData,
      updatedAt: Date.now()
    };

    // Si se proporciona isActive, asegurarse de que sea boolean
    if (typeof req.body.isActive !== 'undefined') {
      updateData.isActive = Boolean(req.body.isActive);
    }

    // Si vienen coordenadas (lat, lng), convertir a formato GeoJSON [lng, lat]
    if (location && location.lat != null && location.lng != null) {
      updateData.location = {
        type: 'Point',
        coordinates: [parseFloat(location.lng), parseFloat(location.lat)]
      };
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Restaurante actualizado exitosamente',
      data: restaurant
    });
  } catch (error) {
    console.error('Error actualizando restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar restaurante'
    });
  }
};

const toggleRestaurantStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { isActive, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    res.json({
      success: true,
      message: `Restaurante ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      data: restaurant
    });
  } catch (error) {
    console.error('Error cambiando estado del restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del restaurante'
    });
  }
};

const getRestaurantStatus = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        id: restaurant._id,
        name: restaurant.name,
        isActive: restaurant.isActive,
        canDelete: restaurant.isActive === false,
        statusMessage: restaurant.isActive === false
          ? 'Puede ser eliminado'
          : 'No puede ser eliminado - debe estar inactivo'
      }
    });
  } catch (error) {
    console.error('Error obteniendo estado del restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado del restaurante'
    });
  }
};

const deleteRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    console.log(`Intentando eliminar restaurante ${restaurant.name}:`);
    console.log(`ID: ${restaurant._id}`);
    console.log(`isActive: ${restaurant.isActive} (tipo: ${typeof restaurant.isActive})`);

    // Solo permitir eliminar si está inactivo
    // Verificar que isActive sea exactamente false
    if (restaurant.isActive !== false) {
      console.log('Restaurante NO puede ser eliminado - no está inactivo');
      return res.status(400).json({
        success: false,
        message: `Solo se pueden eliminar restaurantes inactivos. Este restaurante tiene isActive=${restaurant.isActive}. Primero desactívalo.`,
        restaurantStatus: {
          id: restaurant._id,
          name: restaurant.name,
          isActive: restaurant.isActive
        }
      });
    }

    console.log('Restaurante puede ser eliminado - está inactivo');

    await Restaurant.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Restaurante eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando restaurante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar restaurante'
    });
  }
};

// Gestión de Órdenes

// Órdenes visibles en el panel admin: solo las que tienen pago confirmado (paymentStatus = 'paid').
// Opcional: ?paymentStatus=pending para ver pendientes de pago.
const getAllOrders = async (req, res) => {
  try {
    const paymentFilter = req.query.paymentStatus === 'pending'
      ? { paymentStatus: 'pending' }
      : { paymentStatus: 'paid' };
    const orders = await Order.find(paymentFilter)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name')
      .populate('driverId', 'email name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error obteniendo órdenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de órdenes'
    });
  }
};

// Cancelar un pedido desde el panel de administración
// Solo el admin puede ejecutar esta acción. Se aplica penalidad del 10% si el pedido estaba pagado.
const cancelOrderByAdmin = async (req, res) => {
  try {
    const { reason } = req.body;

    // Buscar el pedido con datos populados
    const order = await Order.findById(req.params.id)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Verificar que el pedido no esté ya en un estado final
    const estadosFinales = [
      'delivered', 'completed', 'cancelled',
      'cancelled_by_client', 'cancelled_by_client_with_penalty',
      'cancelled_by_admin', 'cancelled_by_admin_with_penalty', 'cancelled_by_driver'
    ];
    if (estadosFinales.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Este pedido ya fue entregado o cancelado previamente. No se puede cancelar.'
      });
    }

    // Construir datos base de actualización
    const updateData = {
      cancelledAt: Date.now(),
      cancelledBy: req.user._id,
      cancelledByRole: 'admin',
      cancellationReason: reason || '',
      updatedAt: Date.now()
    };

    let mensaje = '';

    // Lógica según el estado de pago
    if (order.paymentStatus === 'paid') {
      // Pedido pagado → cancelación con penalidad del 10%
      const penalty = Math.round(order.total * 0.10 * 100) / 100;
      const refund = Math.round((order.total - penalty) * 100) / 100;

      updateData.status = 'cancelled_by_admin_with_penalty';
      updateData.penaltyAmount = penalty;
      updateData.refundAmount = refund;

      mensaje = `Pedido #${order._id.toString().slice(-6)} cancelado por admin. Se retuvo $${penalty.toFixed(2)} (10%) como penalidad. Reembolso de $${refund.toFixed(2)} pendiente de procesamiento.`;
    } else {
      // Pedido no pagado → cancelación sin costo
      updateData.status = 'cancelled_by_admin';
      updateData.penaltyAmount = 0;
      updateData.refundAmount = 0;

      mensaje = `Pedido #${order._id.toString().slice(-6)} cancelado por admin sin penalidad.`;
    }

    // Guardar driver asignado antes de desasociarlo, para notificarlo por socket
    const previousDriverId = order.driverId;

    // Entrada de historial de estado para auditoría
    const historyEntry = {
      status: updateData.status,
      changedBy: req.user._id,
      changedAt: new Date(),
      role: 'admin'
    };

    // Actualizar el pedido: setear campos de cancelación, limpiar driverId y agregar historial
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...updateData,
          driverId: null
        },
        $push: { statusHistory: historyEntry }
      },
      { new: true, runValidators: true }
    )
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email name');

    console.log(`[ADMIN] Pedido ${req.params.id} cancelado por admin ${req.user._id}. Estado: ${updateData.status}`);

    // Notificar en tiempo real al driver (si había uno asignado)
    const io = req.app.get('io');
    const socketEvents = require('../socket/events');
    if (io && previousDriverId) {
      const shortId = order._id.toString().slice(-6);
      const msg = `El pedido #${shortId} fue cancelado por el administrador y ya no está asignado a vos.`;
      socketEvents.emitOrderCancelled(io, previousDriverId, {
        orderId: order._id,
        status: updateData.status,
        message: msg
      });
    }
    // Notificar al cliente para que actualice su lista sin polling
    if (io && updatedOrder?.userId?._id) {
      socketEvents.emitOrderStatusChangedToClient(io, updatedOrder.userId._id, {
        orderId: order._id,
        status: updateData.status,
        message: 'Pedido cancelado.'
      });
    }

    res.json({
      success: true,
      message: mensaje,
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error al cancelar pedido desde admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar el pedido. Inténtalo nuevamente.'
    });
  }
};

module.exports = {
  getDashboardStats,
  getDriverCounts,
  getAllDrivers,
  getDriverById,
  verifyDriver,
  toggleDriverAvailability,
  toggleDriverStatus,
  updateDriverProfile,
  deleteDriver,
  getAllRestaurants,
  getRestaurantStatus,
  createRestaurant,
  updateRestaurant,
  toggleRestaurantStatus,
  deleteRestaurant,
  getAllOrders,
  cancelOrderByAdmin
};