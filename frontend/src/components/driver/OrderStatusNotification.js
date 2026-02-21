// Notificación en tiempo real cuando el admin/restaurante marca un pedido como "Preparando".
// Solo se muestra al driver asignado; actualiza estado en la lista y muestra banner no bloqueante.
import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const OrderStatusNotification = ({ onOrderUpdated }) => {
  const { user } = useAuth();
  const { onOrderStatusUpdate } = useSocket();
  const [notification, setNotification] = useState(null); // { orderId, status, message, restaurantName }

  useEffect(() => {
    if (user?.role !== 'driver' || !onOrderStatusUpdate) return;

    const cleanup = onOrderStatusUpdate((payload) => {
      if (payload.status === 'preparing') {
        setNotification({
          orderId: payload.orderId,
          message: payload.message || 'El pedido ya está en preparación en el restaurante.',
          restaurantName: payload.restaurantName
        });
        // Notificar al padre para actualizar la lista de pedidos (ej. en DriverOrders)
        if (onOrderUpdated) onOrderUpdated(payload.orderId, 'preparing');
        // Ocultar el banner después de 8 segundos
        setTimeout(() => setNotification(null), 8000);
      }
    });

    return () => { if (cleanup) cleanup(); };
  }, [user?.role, onOrderStatusUpdate, onOrderUpdated]);

  if (!notification) return null;

  return (
    <div
      className="fixed top-20 left-4 right-4 md:left-1/4 md:right-1/4 z-50 rounded-lg border-2 border-amber-400 bg-amber-50 shadow-lg px-4 py-3 flex items-center gap-3"
      role="alert"
    >
      <span className="text-2xl">🍳</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900">
          ¡Pedido #{notification.orderId?.slice(-6)} está en preparación!
        </p>
        <p className="text-sm text-amber-800 mt-0.5">
          {notification.message}
          {notification.restaurantName && ` — ${notification.restaurantName}`}
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Podés prepararte para salir a recogerlo.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setNotification(null)}
        className="shrink-0 p-1 rounded hover:bg-amber-200 text-amber-800"
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
};

export default OrderStatusNotification;
