// Módulo central de eventos Socket.io para el flujo de órdenes
// Todas las emisiones en tiempo real para admin, driver y cliente

/**
 * Emite a la sala de admins (todos los sockets con role admin)
 */
function toAdminRoom(io, event, payload) {
  if (!io) return;
  io.to('admin-orders').emit(event, payload);
  console.log(`[SOCKET] ${event} → admin-orders`);
}

/**
 * Emite a un usuario específico por su ID (sala user-{userId})
 */
function toUser(io, userId, event, payload) {
  if (!io || !userId) return;
  const id = userId.toString?.() || userId;
  io.to(`user-${id}`).emit(event, payload);
  console.log(`[SOCKET] ${event} → user-${id}`);
}

/**
 * 1. Nueva orden creada por cliente → notificar ADMIN
 */
function emitNewOrderCreated(io, payload) {
  toAdminRoom(io, 'newOrderCreated', payload);
}

/**
 * 2. Admin asignó driver → notificar DRIVER asignado
 */
function emitOrderAssigned(io, driverId, payload) {
  toUser(io, driverId, 'orderAssigned', payload);
}

/**
 * 3. Driver va al restaurante → notificar ADMIN
 */
function emitDriverHeadingToRestaurant(io, payload) {
  toAdminRoom(io, 'driverHeadingToRestaurant', payload);
}

/**
 * 4. Admin marcó "Pedido listo" → notificar DRIVER
 */
function emitOrderReadyForPickup(io, driverId, payload) {
  toUser(io, driverId, 'orderReadyForPickup', payload);
}

/**
 * 5. Driver va a entregar (on_the_way) → notificar ADMIN y CLIENTE
 */
function emitOrderOnTheWay(io, clientUserId, payload) {
  toAdminRoom(io, 'orderOnTheWay', payload);
  toUser(io, clientUserId, 'orderOnTheWay', payload);
}

/**
 * 6. Driver llegó al restaurante → notificar CLIENTE (para abrir mapa en tiempo real)
 */
function emitDriverArrivedAtRestaurant(io, clientUserId, payload) {
  toUser(io, clientUserId, 'driverArrivedAtRestaurant', payload);
}

/**
 * 7. Driver marcó entregado → notificar CLIENTE
 */
function emitOrderDelivered(io, clientUserId, payload) {
  toUser(io, clientUserId, 'orderDelivered', payload);
}

/**
 * 8. Cliente confirmó entrega → notificar ADMIN y DRIVER
 */
function emitOrderCompleted(io, driverId, payload) {
  toAdminRoom(io, 'orderCompleted', payload);
  if (driverId) toUser(io, driverId, 'orderCompleted', payload);
}

/**
 * 9. Pedido cancelado (por cliente o admin) → notificar DRIVER asignado
 * Para que deje de verlo en su lista de pedidos activos.
 */
function emitOrderCancelled(io, driverId, payload) {
  if (!driverId) return;
  toUser(io, driverId, 'orderCancelled', payload);
}

/**
 * 9. Pedido reasignado → notificar al driver ANTERIOR de que ya no tiene el pedido
 */
function emitOrderReassignedAway(io, driverId, payload) {
  if (!driverId) return;
  toUser(io, driverId, 'orderReassignedAway', payload);
}

/**
 * 10. Pedido reasignado → notificar al NUEVO driver de que tiene un pedido reasignado
 * Se puede tratar similar a una nueva asignación, pero con mensaje distinto.
 */
function emitOrderReassignedTo(io, driverId, payload) {
  if (!driverId) return;
  toUser(io, driverId, 'orderReassignedToYou', payload);
}

/**
 * Notificar al CLIENTE que el estado de su pedido cambió (para sincronizar lista sin polling).
 * Se llama en cada cambio de estado que afecte al cliente: assigned, ready_for_pickup,
 * heading_to_restaurant, at_restaurant, on_the_way, delivered, completed, cancelled.
 */
function emitOrderStatusChangedToClient(io, clientUserId, payload) {
  if (!clientUserId) return;
  toUser(io, clientUserId, 'orderStatusChanged', payload);
}

module.exports = {
  emitNewOrderCreated,
  emitOrderAssigned,
  emitDriverHeadingToRestaurant,
  emitOrderReadyForPickup,
  emitOrderOnTheWay,
  emitDriverArrivedAtRestaurant,
  emitOrderDelivered,
  emitOrderCompleted,
  emitOrderCancelled,
  emitOrderReassignedAway,
  emitOrderReassignedTo,
  emitOrderStatusChangedToClient
};
