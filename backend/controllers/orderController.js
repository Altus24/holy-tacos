// Controlador de órdenes: flujo lineal y notificaciones en tiempo real
const Order = require('../models/Order');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const socketEvents = require('../socket/events');

/**
 * Transiciones permitidas por rol (flujo estricto)
 * Driver: assigned → heading_to_restaurant → ready_for_pickup → at_restaurant → on_the_way → delivered
 * Admin: puede asignar (pending→assigned) y marcar listo (assigned/heading_to_restaurant → ready_for_pickup)
 * Client: delivered → completed
 */
const DRIVER_TRANSITIONS = {
  assigned: 'heading_to_restaurant',
  ready_for_pickup: 'at_restaurant',
  at_restaurant: 'on_the_way',
  on_the_way: 'delivered'
};

/**
 * Asignar o reasignar conductor a un pedido (solo admin).
 * - Asignación inicial: pending → assigned, sin driver previo.
 * - Reasignación: driverId ya existía y se cambia a otro driver.
 *   Emite notificaciones a driver anterior y nuevo.
 */
const assignDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId, reassign } = req.body;
    const io = req.app.get('io');

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'ID del conductor es requerido'
      });
    }

    const order = await Order.findById(id)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name')
      .populate('driverId', 'email name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden asignar conductores a pedidos con pago confirmado. Esta orden está pendiente de pago o el pago falló.'
      });
    }

    const estadosFinales = [
      'delivered', 'completed', 'cancelled',
      'cancelled_by_client', 'cancelled_by_client_with_penalty',
      'cancelled_by_admin', 'cancelled_by_admin_with_penalty', 'cancelled_by_driver'
    ];

    // Si ya está en estados finales o en camino, no permitir reasignar/asignar
    if (estadosFinales.includes(order.status) || order.status === 'on_the_way') {
      return res.status(400).json({
        success: false,
        message: `No se puede asignar o reasignar un conductor cuando el pedido está en estado "${order.status}".`
      });
    }

    const previousDriverId = order.driverId?._id || order.driverId || null;
    const isReassign = Boolean(previousDriverId) && previousDriverId.toString() !== driverId.toString();

    // Si ya tiene driver y no viene flag de reasignar, bloquear para evitar cambios accidentales
    if (previousDriverId && !isReassign && !reassign) {
      return res.status(400).json({
        success: false,
        message: 'Este pedido ya tiene un conductor asignado. Usá la opción de \"Reasignar driver\".'
      });
    }

    // Para asignación inicial, seguir exigiendo estado pending
    if (!previousDriverId && order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden asignar conductores a pedidos en estado pendiente.'
      });
    }

    // Determinar nuevo estado después de reasignar/asignar
    // Regla simple: dejar el pedido en "assigned" para que el nuevo driver arranque desde el principio.
    const newStatus = 'assigned';

    // Armar historial de estado
    const historyEntries = [];

    if (isReassign) {
      // Buscar info del nuevo driver para registrar notas legibles
      const newDriver = await User.findById(driverId).select('name email');
      const oldLabel = order.driverId?.name || order.driverId?.email || 'driver anterior';
      const newLabel = newDriver?.name || newDriver?.email || 'nuevo driver';

      historyEntries.push({
        status: 'reassigned',
        changedBy: req.user._id,
        changedAt: new Date(),
        role: 'admin',
        notes: `Pedido reasignado de ${oldLabel} a ${newLabel}`
      });
    }

    historyEntries.push({
      status: newStatus,
      changedBy: req.user._id,
      changedAt: new Date(),
      role: 'admin'
    });

    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: { driverId, status: newStatus, updatedAt: new Date() },
        $push: { statusHistory: { $each: historyEntries } }
      },
      { new: true, runValidators: true }
    )
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email name');

    const shortId = updated._id.toString().slice(-6);

    if (isReassign && previousDriverId) {
      // Notificar al driver anterior que el pedido fue reasignado
      socketEvents.emitOrderReassignedAway(io, previousDriverId, {
        orderId: updated._id,
        message: `El pedido #${shortId} te fue reasignado a otro conductor.`,
        newDriverName: updated.driverId?.name || updated.driverId?.email || null
      });

      // Notificar al nuevo driver que recibió una reasignación
      socketEvents.emitOrderReassignedTo(io, driverId, {
        orderId: updated._id,
        status: newStatus,
        message: `Te reasignaron el pedido #${shortId}. Revisá los detalles.`,
        restaurantName: updated.restaurantId?.name || null
      });
    } else {
      // Asignación inicial: misma lógica que antes
      socketEvents.emitOrderAssigned(io, driverId, {
        orderId: updated._id,
        status: newStatus,
        message: 'Te asignaron un nuevo pedido. Espera a que el restaurante lo prepare.',
        restaurantName: updated.restaurantId?.name || null
      });
    }

    // Notificar al cliente para que actualice su lista sin polling
    const clientId = updated.userId?._id || updated.userId;
    socketEvents.emitOrderStatusChangedToClient(io, clientId, {
      orderId: updated._id,
      status: newStatus,
      message: 'Tu pedido tiene conductor asignado.'
    });

    return res.json({
      success: true,
      message: isReassign ? 'Conductor reasignado correctamente' : 'Conductor asignado correctamente',
      data: updated
    });
  } catch (error) {
    console.error('Error al asignar/conductor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al asignar o reasignar conductor'
    });
  }
};

/**
 * Marcar pedido como listo para recoger (solo admin). assigned | heading_to_restaurant → ready_for_pickup.
 * Emite 'orderReadyForPickup' al driver.
 */
const setReadyForPickup = async (req, res) => {
  try {
    const { id } = req.params;
    const io = req.app.get('io');

    const order = await Order.findById(id)
      .populate('restaurantId', 'name')
      .populate('driverId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    const allowedFrom = ['assigned', 'heading_to_restaurant'];
    if (!allowedFrom.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Solo se puede marcar como listo cuando el pedido está en estado "Asignado" o "Driver en camino al restaurante". Estado actual: ${order.status}`
      });
    }

    const historyEntry = {
      status: 'ready_for_pickup',
      changedBy: req.user._id,
      changedAt: new Date(),
      role: 'admin'
    };

    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: { status: 'ready_for_pickup', updatedAt: new Date() },
        $push: { statusHistory: historyEntry }
      },
      { new: true, runValidators: true }
    )
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email name');

    const driverId = updated.driverId?._id || updated.driverId;
    if (driverId) {
      socketEvents.emitOrderReadyForPickup(io, driverId, {
        orderId: updated._id,
        message: 'El pedido ya está listo para que lo recojas en el restaurante',
        restaurantName: updated.restaurantId?.name || null
      });
    }

    // Notificar al cliente para que actualice su lista sin polling
    const clientId = updated.userId?._id || updated.userId;
    socketEvents.emitOrderStatusChangedToClient(io, clientId, {
      orderId: updated._id,
      status: 'ready_for_pickup',
      message: 'Tu pedido está listo para recoger.'
    });

    return res.json({
      success: true,
      message: 'Pedido marcado como listo para recoger',
      data: updated
    });
  } catch (error) {
    console.error('Error al marcar pedido listo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el pedido'
    });
  }
};

/**
 * Actualizar estado (driver): solo transiciones permitidas.
 * heading_to_restaurant → emit driverHeadingToRestaurant (admin)
 * on_the_way → emit orderOnTheWay (admin + cliente)
 * delivered → emit orderDelivered (cliente) y set deliveredAt
 */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const io = req.app.get('io');

    const order = await Order.findById(id)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name')
      .populate('driverId', 'email name');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const driverId = order.driverId?._id?.toString() || order.driverId?.toString();
    if (req.user.role !== 'driver' || driverId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Solo el conductor asignado puede actualizar el estado de este pedido'
      });
    }

    const nextStatus = DRIVER_TRANSITIONS[order.status];
    const allowedDriverStatuses = ['heading_to_restaurant', 'at_restaurant', 'on_the_way', 'delivered'];
    if (!allowedDriverStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no permitido para el conductor. Solo: Voy a recoger, En el restaurante, Voy a entregar, Entregado.'
      });
    }

    // Validar transición lineal
    if (status === 'heading_to_restaurant' && order.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Solo podés marcar "Voy a recoger" cuando el pedido está asignado.'
      });
    }
    if (status === 'at_restaurant' && order.status !== 'ready_for_pickup') {
      return res.status(400).json({
        success: false,
        message: 'Solo podés marcar "En el restaurante" cuando el pedido está listo para recoger.'
      });
    }
    if (status === 'on_the_way' && order.status !== 'at_restaurant') {
      return res.status(400).json({
        success: false,
        message: 'Solo podés marcar "Voy a entregar" cuando ya estás en el restaurante.'
      });
    }
    if (status === 'delivered' && order.status !== 'on_the_way') {
      return res.status(400).json({
        success: false,
        message: 'Solo podés marcar "Entregado" cuando ya estás en camino a entregar.'
      });
    }

    const historyEntry = {
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      role: 'driver'
    };

    const setData = { status, updatedAt: new Date() };
    if (status === 'delivered') setData.deliveredAt = new Date();

    const updated = await Order.findByIdAndUpdate(
      id,
      { $set: setData, $push: { statusHistory: historyEntry } },
      { new: true, runValidators: true }
    )
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email name');

    const driverName = updated.driverId?.name || updated.driverId?.email || 'El conductor';
    const shortId = updated._id.toString().slice(-6);

    const clientId = updated.userId?._id || updated.userId;

    if (status === 'heading_to_restaurant') {
      // Driver salió hacia el restaurante (solo interesa a admins)
      socketEvents.emitDriverHeadingToRestaurant(io, {
        orderId: updated._id,
        driverName,
        message: 'El driver está en camino al restaurante'
      });
    } else if (status === 'at_restaurant') {
      // Driver llegó al restaurante → notificar al cliente para abrir el mapa en tiempo real
      socketEvents.emitDriverArrivedAtRestaurant(io, clientId, {
        orderId: updated._id,
        driverName,
        message: 'El driver ya llegó al restaurante. Podés seguir su ubicación en el mapa.'
      });
    } else if (status === 'on_the_way') {
      socketEvents.emitOrderOnTheWay(io, clientId, {
        orderId: updated._id,
        driverName,
        message: 'El pedido está en camino a tu domicilio'
      });
    } else if (status === 'delivered') {
      socketEvents.emitOrderDelivered(io, clientId, {
        orderId: updated._id,
        message: `Tu pedido #${shortId} ha sido entregado por el driver. Por favor confirma la recepción.`
      });
    }

    // Notificar al cliente en cada cambio de estado para sincronizar lista sin polling
    socketEvents.emitOrderStatusChangedToClient(io, clientId, {
      orderId: updated._id,
      status,
      message: `Estado del pedido: ${status}`
    });

    return res.json({
      success: true,
      message: `Estado actualizado a ${status}`,
      data: updated
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado del pedido'
    });
  }
};

/**
 * Cliente confirma la entrega. delivered → completed. Solo el dueño del pedido.
 * Emite 'orderCompleted' a admin y driver.
 */
const confirmDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const io = req.app.get('io');

    const order = await Order.findById(id).populate('driverId', 'email name');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Solo el cliente que realizó el pedido puede confirmar la entrega'
      });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Solo podés confirmar la entrega cuando el pedido está en estado "Entregado"'
      });
    }

    const historyEntry = {
      status: 'completed',
      changedBy: req.user._id,
      changedAt: new Date(),
      role: 'client'
    };

    const updated = await Order.findByIdAndUpdate(
      id,
      { $set: { status: 'completed', updatedAt: new Date() }, $push: { statusHistory: historyEntry } },
      { new: true, runValidators: true }
    )
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email name');

    const driverId = updated.driverId?._id || updated.driverId;
    const shortId = updated._id.toString().slice(-6);
    socketEvents.emitOrderCompleted(io, driverId, {
      orderId: updated._id,
      message: `El cliente confirmó la recepción del pedido #${shortId}`
    });

    // Notificar al cliente (él mismo) para que actualice su lista sin polling
    const clientId = updated.userId?._id || updated.userId;
    socketEvents.emitOrderStatusChangedToClient(io, clientId, {
      orderId: updated._id,
      status: 'completed',
      message: 'Entrega confirmada.'
    });

    // Incrementar totalDeliveries del conductor
    if (driverId) {
      await User.findByIdAndUpdate(driverId, {
        $inc: { 'driverProfile.totalDeliveries': 1 }
      });
    }

    return res.json({
      success: true,
      message: 'Entrega confirmada. ¡Gracias!',
      data: updated
    });
  } catch (error) {
    console.error('Error al confirmar entrega:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al confirmar la entrega'
    });
  }
};

/**
 * Cliente califica al conductor y al restaurante. Solo pedidos completed, solo dueño del pedido.
 * Actualiza promedios en User.driverProfile.rating y Restaurant.rating.
 */
const rateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverStars, driverComment, restaurantStars, restaurantComment } = req.body;

    const order = await Order.findById(id)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name')
      .populate('driverId', 'email name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if ((order.userId?._id || order.userId).toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Solo el cliente que realizó el pedido puede calificar'
      });
    }
    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Solo podés calificar pedidos completados'
      });
    }

    const dStars = driverStars != null ? Number(driverStars) : null;
    const rStars = restaurantStars != null ? Number(restaurantStars) : null;
    if ((!dStars || dStars < 1 || dStars > 5) || (!rStars || rStars < 1 || rStars > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Debés dar entre 1 y 5 estrellas al conductor y al restaurante'
      });
    }

    const driverRating = {
      stars: dStars,
      comment: (driverComment || '').trim().slice(0, 500),
      ratedAt: new Date()
    };
    const restaurantRating = {
      stars: rStars,
      comment: (restaurantComment || '').trim().slice(0, 500),
      ratedAt: new Date()
    };

    await Order.findByIdAndUpdate(id, {
      $set: { driverRating, restaurantRating, updatedAt: new Date() }
    });

    // Recalcular promedio del conductor (todas las órdenes con driverRating)
    const driverId = order.driverId?._id || order.driverId;
    if (driverId) {
      const driverOrders = await Order.find({
        driverId,
        'driverRating.stars': { $exists: true, $gte: 1 }
      }).select('driverRating.stars');
      const total = driverOrders.length;
      const sum = driverOrders.reduce((acc, o) => acc + (o.driverRating?.stars || 0), 0);
      const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : 5;
      await User.findByIdAndUpdate(driverId, {
        $set: { 'driverProfile.rating': Math.min(5, Math.max(1, avg)) }
      });
    }

    // Recalcular promedio del restaurante
    const restaurantId = order.restaurantId?._id || order.restaurantId;
    if (restaurantId) {
      const restOrders = await Order.find({
        restaurantId,
        'restaurantRating.stars': { $exists: true, $gte: 1 }
      }).select('restaurantRating.stars');
      const total = restOrders.length;
      const sum = restOrders.reduce((acc, o) => acc + (o.restaurantRating?.stars || 0), 0);
      const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;
      await Restaurant.findByIdAndUpdate(restaurantId, {
        $set: { rating: Math.min(5, Math.max(0, avg)) }
      });
    }

    const updated = await Order.findById(id)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email name');

    return res.json({
      success: true,
      message: 'Gracias por tu calificación',
      data: updated
    });
  } catch (error) {
    console.error('Error al calificar pedido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar la calificación'
    });
  }
};

/**
 * Conteos para el conductor: asignados (activos) y completados (hoy y total).
 * Solo pedidos asignados a este driver; asignados = no completados ni cancelados.
 */
const STATUS_ASIGNADOS = [
  'assigned',
  'heading_to_restaurant',
  'ready_for_pickup',
  'at_restaurant',
  'on_the_way',
  'delivered'
];

const getDriverOrderCounts = async (req, res) => {
  try {
    const driverId = req.user._id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [assigned, completedTotal, completedToday] = await Promise.all([
      Order.countDocuments({
        driverId,
        status: { $in: STATUS_ASIGNADOS }
      }),
      Order.countDocuments({
        driverId,
        status: 'completed'
      }),
      Order.countDocuments({
        driverId,
        status: 'completed',
        updatedAt: { $gte: startOfToday }
      })
    ]);

    return res.json({
      success: true,
      data: {
        assigned,
        completedToday,
        completedTotal
      }
    });
  } catch (error) {
    console.error('Error al obtener conteos del conductor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener conteos'
    });
  }
};

const CANCELLED_STATUSES = [
  'cancelled',
  'cancelled_by_client',
  'cancelled_by_client_with_penalty',
  'cancelled_by_admin',
  'cancelled_by_admin_with_penalty',
  'cancelled_by_driver'
];

/**
 * Lista de pedidos del conductor con filtro opcional ?status=assigned|completed|all
 */
const getDriverOrders = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { status: filter = 'all' } = req.query;

    const baseQuery = { driverId };

    if (filter === 'assigned') {
      baseQuery.status = { $in: STATUS_ASIGNADOS };
    } else if (filter === 'completed') {
      baseQuery.status = 'completed';
    } else {
      // all: excluir solo cancelados
      baseQuery.status = { $nin: CANCELLED_STATUSES };
    }

    const orders = await Order.find(baseQuery)
      .populate('userId', 'email name')
      .populate('restaurantId', 'name address phone')
      .populate('driverId', 'email name profilePicture')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error al obtener pedidos del conductor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos'
    });
  }
};

module.exports = {
  assignDriver,
  setReadyForPickup,
  updateStatus,
  confirmDelivery,
  rateOrder,
  getDriverOrderCounts,
  getDriverOrders
};
