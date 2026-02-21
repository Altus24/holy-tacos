// Rutas para gestión de pedidos en Holy Tacos
const express = require('express');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { authenticateToken, requireAuth, requireAdmin, requireDriver } = require('../middleware/auth');
const orderController = require('../controllers/orderController');
const socketEvents = require('../socket/events');

// Construir dirección de entrega en texto desde objeto del perfil (defaultAddress o savedAddress)
function buildDeliveryAddressFromProfile(addr) {
  if (!addr || (!addr.street && !addr.number)) return '';
  const parts = [addr.street, addr.number].filter(Boolean).join(' ');
  const extra = [addr.floor && `Piso ${addr.floor}`, addr.apartment && `Depto ${addr.apartment}`].filter(Boolean).join(', ');
  const notes = addr.notes ? ` (${addr.notes})` : '';
  return [parts, extra].filter(Boolean).join(', ') + notes;
}

const router = express.Router();

// GET /api/orders - Obtener pedidos filtrados por rol
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = {};

    // Filtrar según el rol del usuario
    if (req.user.role === 'admin') {
      // Admin solo ve órdenes con pago confirmado (evitar asignar driver a órdenes no pagadas)
      query = { paymentStatus: 'paid' };
    } else if (req.user.role === 'driver') {
      // Driver solo ve pedidos asignados a él que NO estén cancelados
      // Importante: excluir todos los estados de cancelación para que no vea pedidos ya cancelados.
      query = {
        driverId: req.user._id,
        status: {
          $nin: [
            'cancelled',
            'cancelled_by_client',
            'cancelled_by_client_with_penalty',
            'cancelled_by_admin',
            'cancelled_by_admin_with_penalty',
            'cancelled_by_driver'
          ]
        }
      };
    } else {
      // Cliente ve solo sus propios pedidos
      query = { userId: req.user._id };
    }

    const orders = await Order.find(query)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone location')
      .populate('driverId', 'email name profilePicture')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los pedidos'
    });
  }
});

// GET /api/orders/:id - Obtener detalles de un pedido específico
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      // Incluir nombre e imagen del conductor en el detalle para cliente y driver
      .populate('driverId', 'email name profilePicture');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el pedido'
    });
  }
});

// POST /api/orders - Crear un nuevo pedido (usa defaultAddress del perfil si no se envía dirección)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { restaurantId, items, deliveryAddress: bodyAddress, notes, deliveryLat, deliveryLng } = req.body;
    const userId = req.user._id;

    // Validar datos requeridos (restaurantId e items son obligatorios)
    if (!userId || !restaurantId || !items) {
      return res.status(400).json({
        success: false,
        message: 'Usuario, restaurante e items son obligatorios'
      });
    }

    let deliveryAddress = (bodyAddress && String(bodyAddress).trim()) || '';
    let deliveryLocation = null;
    if (deliveryLat != null && deliveryLng != null && !Number.isNaN(Number(deliveryLat)) && !Number.isNaN(Number(deliveryLng))) {
      deliveryLocation = { lat: Number(deliveryLat), lng: Number(deliveryLng) };
    }

    // Si no hay dirección en el body, usar la dirección predeterminada del perfil del cliente
    if (!deliveryAddress) {
      const user = await User.findById(userId).select('clientProfile').lean();
      const defaultAddr = user?.clientProfile?.defaultAddress;
      if (defaultAddr && (defaultAddr.street || defaultAddr.number)) {
        deliveryAddress = buildDeliveryAddressFromProfile(defaultAddr);
        if (defaultAddr.location?.coordinates?.length >= 2) {
          const [lng, lat] = defaultAddr.location.coordinates;
          deliveryLocation = { lat, lng };
        }
      }
    }

    if (!deliveryAddress || !deliveryAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'La dirección de entrega es obligatoria. Agregá una en tu perfil o ingresala aquí.'
      });
    }

    // Verificar que el restaurante existe
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurante no encontrado'
      });
    }

    // Validar que los items existan en el menú del restaurante
    const menuItems = restaurant.menu;
    const itemsInvalidos = items.filter(item => {
      return !menuItems.some(menuItem => menuItem.name === item.name);
    });

    if (itemsInvalidos.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Algunos items no existen en el menú del restaurante',
        itemsInvalidos: itemsInvalidos.map(item => item.name)
      });
    }

    // Calcular precios y crear el pedido
    const itemsConPrecio = items.map(item => {
      const menuItem = menuItems.find(mi => mi.name === item.name);
      return {
        name: item.name,
        price: menuItem.price,
        quantity: item.quantity,
        subtotal: menuItem.price * item.quantity
      };
    });

    const subtotal = itemsConPrecio.reduce((total, item) => total + item.subtotal, 0);
    const deliveryFee = 25; // Costo fijo de entrega
    const total = subtotal + deliveryFee;

    // Palabra de seguridad aleatoria por pedido (visible para cliente y driver cuando el conductor va a entregar)
    const safetyWords = [
      'taco', 'salsa', 'guacamole', 'queso', 'nacho', 'picante', 'limon', 'cilantro', 'maiz', 'burro', 'chile', 'frijol',
      'sol', 'luna', 'estrella', 'mar', 'rio', 'flor', 'piedra', 'nube', 'viento', 'fuego', 'agua', 'arbol',
      'gato', 'perro', 'pajaro', 'tigre', 'leon', 'oso', 'lobo', 'zorro', 'delfin', 'tortuga', 'serpiente',
      'manzana', 'naranja', 'uva', 'melon', 'sandia', 'mango', 'coco', 'piña', 'fresa', 'cereza', 'durazno', 'lima',
      'campana', 'puerta', 'ventana', 'llave', 'casa', 'jardin', 'mesa', 'silla', 'libro', 'luz', 'reloj', 'mapa'
    ];
    const randomIndex = Math.floor(Math.random() * safetyWords.length);
    const safetyWord = safetyWords[randomIndex];

    // Crear el pedido (incluir coordenadas de entrega si se enviaron o vienen del perfil)
    const orderData = {
      userId,
      restaurantId,
      items: itemsConPrecio,
      deliveryAddress: deliveryAddress.trim(),
      notes: notes ? String(notes).trim() : undefined,
      subtotal,
      deliveryFee,
      total,
      safetyWord
    };
    if (deliveryLocation) {
      orderData.deliveryLocation = deliveryLocation;
    }
    // Guardar coordenadas del restaurante en el pedido (para mapas en cliente)
    if (restaurant.location?.coordinates?.length >= 2) {
      const [restLng, restLat] = restaurant.location.coordinates;
      orderData.restaurantLocation = { lat: restLat, lng: restLng };
    }
    const order = new Order(orderData);

    const nuevoPedido = await order.save();

    // Popular la información del pedido para la respuesta
    await nuevoPedido.populate('userId', 'email name');
    await nuevoPedido.populate('restaurantId', 'name address');

    // Notificación en tiempo real al ADMIN: nueva orden pendiente de asignación
    const io = req.app.get('io');
    if (io) {
      const customerName = nuevoPedido.userId?.name || nuevoPedido.userId?.email || 'Cliente';
      const restaurantName = nuevoPedido.restaurantId?.name || 'Restaurante';
      socketEvents.emitNewOrderCreated(io, {
        orderId: nuevoPedido._id,
        customerName,
        restaurantName,
        total: nuevoPedido.total,
        message: 'Nueva orden pendiente de asignación'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      data: nuevoPedido
    });
  } catch (error) {
    console.error('Error al crear pedido:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear el pedido'
    });
  }
});

// PUT /api/orders/:id/status - Actualizar estado (driver: heading_to_restaurant, on_the_way, delivered). Flujo lineal.
router.put('/:id/status', authenticateToken, (req, res) => {
  if (req.user.role === 'driver') {
    return orderController.updateStatus(req, res);
  }
  return res.status(403).json({
    success: false,
    message: 'Solo el conductor asignado puede actualizar el estado con esta ruta. Los admins usan Asignar driver y Marcar listo.'
  });
});

// PUT /api/orders/:id/confirm-delivery - Cliente confirma la entrega (delivered → completed). Solo el dueño del pedido.
router.put('/:id/confirm-delivery', authenticateToken, orderController.confirmDelivery);

// POST /api/orders/:id/rate - Cliente califica conductor y restaurante (solo pedido completed, solo dueño).
router.post('/:id/rate', authenticateToken, orderController.rateOrder);

// PUT /api/orders/:id/cancel - Cancelar pedido por parte del cliente
// Solo el dueño del pedido puede cancelarlo. La penalidad depende del estado de pago.
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    // Buscar el pedido
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Verificar que el usuario sea el dueño del pedido (o admin)
    if (req.user.role !== 'admin' && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tenés permisos para cancelar este pedido. Solo el dueño puede cancelarlo.'
      });
    }

    // Verificar que el pedido no esté ya en un estado final
    const estadosFinales = ['delivered', 'completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_client_with_penalty'];
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
      cancelledByRole: req.user.role === 'admin' ? 'admin' : 'client',
      cancellationReason: cancellationReason || '',
      updatedAt: Date.now()
    };

    let mensaje = '';

    // Lógica según el estado de pago
    if (order.paymentStatus === 'paid') {
      // Pedido pagado → cancelación con penalidad del 10%
      const penalty = Math.round(order.total * 0.10 * 100) / 100; // Redondear a 2 decimales
      const refund = Math.round((order.total - penalty) * 100) / 100;

      updateData.status = 'cancelled_by_client_with_penalty';
      updateData.penaltyAmount = penalty;
      updateData.refundAmount = refund;
      // Simular reembolso (no integrar Stripe refund real todavía)
      // TODO: Integrar Stripe refund cuando se implemente el sistema de pagos completo

      mensaje = `Pedido cancelado. Se retuvo $${penalty.toFixed(2)} (10%) como penalidad por cancelación. El reembolso de $${refund.toFixed(2)} será procesado pronto.`;
    } else {
      // Pedido no pagado → cancelación sin costo
      updateData.status = 'cancelled_by_client';
      updateData.penaltyAmount = 0;
      updateData.refundAmount = 0;

      mensaje = 'Pedido cancelado correctamente. No se aplicó ninguna penalidad.';
    }

    // Preparar entrada de historial de estado
    const historyEntry = {
      status: updateData.status,
      changedBy: req.user._id,
      changedAt: new Date(),
      role: req.user.role === 'admin' ? 'admin' : 'client'
    };

    // Guardar driver asignado antes de desasociarlo, para notificarlo por socket
    const previousDriverId = order.driverId;

    // Actualizar el pedido (setear estado de cancelación, limpiar driverId y agregar historial)
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
      .populate('userId', 'email')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email');

    console.log(`Pedido ${req.params.id} cancelado por usuario ${req.user._id}. Estado: ${updateData.status}`);

    // Notificar en tiempo real al driver (si había uno asignado)
    const io = req.app.get('io');
    const socketEvents = require('../socket/events');
    if (io && previousDriverId) {
      const shortId = order._id.toString().slice(-6);
      const msg = `El pedido #${shortId} fue cancelado y ya no está asignado a vos.`;
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
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar el pedido. Inténtalo nuevamente.'
    });
  }
});

// DELETE /api/orders/:id - Cancelar pedido (solo si está pendiente)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    // Verificar permisos: solo el propietario del pedido o admin pueden cancelarlo
    if (req.user.role !== 'admin' && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cancelar este pedido'
      });
    }

    // Solo permitir cancelar pedidos pendientes
    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden cancelar pedidos pendientes'
      });
    }

    // Cambiar estado a cancelado en lugar de eliminar
    order.status = 'cancelled';
    order.updatedAt = Date.now();
    await order.save();

    res.json({
      success: true,
      message: 'Pedido cancelado exitosamente'
    });
  } catch (error) {
    console.error('Error al cancelar pedido:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar el pedido'
    });
  }
});

// GET /api/orders/available-drivers - Obtener conductores disponibles (solo admin)
router.get('/available-drivers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const drivers = await User.find({ role: 'driver' }).select('email _id name');

    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (error) {
    console.error('Error al obtener conductores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener conductores'
    });
  }
});

module.exports = router;