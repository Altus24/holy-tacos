// Contexto de Socket.io para Holy Tacos
// Maneja la conexión global de sockets y eventos en tiempo real
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import API_BASE_URL from '../config/api';

// Crear el contexto
const SocketContext = createContext();

// Hook personalizado para usar el contexto
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket debe usarse dentro de un SocketProvider');
  }
  return context;
};

// Proveedor del contexto
export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const connectingRef = useRef(false); // Guard contra conexiones duplicadas
  const [isConnected, setIsConnected] = useState(false);
  const [currentOrderRoom, setCurrentOrderRoom] = useState(null);

  // Conectar al socket cuando el usuario se autentique
  useEffect(() => {
    const authenticated = isAuthenticated();
    const shouldConnect = authenticated && user;

    if (shouldConnect && !socketRef.current?.connected && !connectingRef.current) {
      console.log('🔌 Usuario autenticado, conectando socket...');
      connectSocket();
    } else if (!shouldConnect && socketRef.current) {
      console.log('🔌 Usuario no autenticado, desconectando socket...');
      disconnectSocket();
    }

    return () => {
      // Solo desconectar si el componente se desmonta completamente
    };
    // Usar user?._id para evitar reconexiones innecesarias por cambio de referencia del objeto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Función para conectar al socket
  const connectSocket = async () => {
    // Evitar conexiones duplicadas simultáneas
    if (connectingRef.current || socketRef.current?.connected) return;
    connectingRef.current = true;

    try {
      // Primero verificar que el backend esté disponible
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${API_BASE_URL}/api/estado`, {
          method: 'HEAD',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Backend no responde correctamente');
        }
      } catch (error) {
        console.warn('⚠️ Backend no disponible, esperando para conectar socket...');
        connectingRef.current = false;
        // Reintentar en 3 segundos (máximo, no infinito — Socket.IO lo maneja)
        setTimeout(() => connectSocket(), 3000);
        return;
      }

      // Obtener token JWT del localStorage
      const token = localStorage.getItem('token');

      if (!token) {
        console.warn('No hay token JWT disponible para conectar al socket');
        connectingRef.current = false;
        return;
      }

      // Desconectar socket anterior si existe
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Crear conexión de socket
      socketRef.current = io(API_BASE_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });

      // Manejar eventos de conexión
      socketRef.current.on('connect', () => {
        console.log('🔌 Conectado al servidor de sockets');
        connectingRef.current = false;
        setIsConnected(true);
      });

      socketRef.current.on('connect_error', (error) => {
        console.warn('⚠️ Error de conexión al socket:', error.message);
        connectingRef.current = false;
        setIsConnected(false);
      });

      socketRef.current.on('reconnect', () => {
        console.log('🔄 Reconectado al servidor de sockets');
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('🔌 Desconectado del servidor de sockets:', reason);
        connectingRef.current = false;
        setIsConnected(false);
      });

      // Manejar errores generales
      socketRef.current.on('error', (error) => {
        console.error('Error en socket:', error);
      });

    } catch (error) {
      console.error('Error al conectar al socket:', error);
      connectingRef.current = false;
    }
  };

  // Función para desconectar el socket
  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCurrentOrderRoom(null);
    }
  };

  // Función para unirse a una sala de pedido
  const joinOrderRoom = (orderId) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket no conectado, intentando reconectar...');
      connectSocket();
      return;
    }

    try {
      // Salir de la sala anterior si existe
      if (currentOrderRoom) {
        socketRef.current.emit('leaveOrderRoom', currentOrderRoom);
      }

      // Unirse a la nueva sala
      socketRef.current.emit('joinOrderRoom', orderId);
      setCurrentOrderRoom(orderId);
      console.log(`📍 Unido a la sala del pedido: ${orderId}`);
    } catch (error) {
      console.error('Error al unirse a la sala del pedido:', error);
    }
  };

  // Función para salir de la sala del pedido
  const leaveOrderRoom = () => {
    if (socketRef.current && currentOrderRoom) {
      socketRef.current.emit('leaveOrderRoom', currentOrderRoom);
      setCurrentOrderRoom(null);
      console.log(`📍 Salido de la sala del pedido`);
    }
  };

  // Función para actualizar ubicación del driver
  const updateDriverLocation = (orderId, lat, lng) => {
    if (!socketRef.current || !isConnected) {
      console.warn('Socket no conectado, no se puede actualizar ubicación');
      return;
    }

    if (user?.role !== 'driver') {
      console.warn('Solo los drivers pueden actualizar ubicación');
      return;
    }

    try {
      socketRef.current.emit('updateDriverLocation', {
        orderId,
        lat,
        lng
      });
      console.log(`📍 Ubicación enviada: ${lat}, ${lng} para pedido ${orderId}`);
    } catch (error) {
      console.error('Error al enviar ubicación:', error);
    }
  };

  // Función para escuchar actualizaciones de ubicación del driver (por pedido)
  const onDriverLocationUpdate = (callback) => {
    if (!socketRef.current) return;

    socketRef.current.on('driverLocationUpdate', callback);

    // Retornar función para remover el listener
    return () => {
      socketRef.current?.off('driverLocationUpdate', callback);
    };
  };

  // Función para escuchar broadcast de ubicación en tiempo real del driver
  // Usado por clientes con pedidos activos y por el admin
  const onDriverLocationBroadcast = (callback) => {
    if (!socketRef.current) return;

    socketRef.current.on('driverLocationBroadcast', callback);

    return () => {
      socketRef.current?.off('driverLocationBroadcast', callback);
    };
  };

  // Función para escuchar actualizaciones de verificación del driver
  const onVerificationUpdate = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('verificationUpdate', callback);
    return () => { socketRef.current?.off('verificationUpdate', callback); };
  };

  // Función para escuchar actualización de estado del pedido (ej.: admin marca 'preparing' → notificar al driver)
  const onOrderStatusUpdate = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderStatusUpdate', callback);
    return () => { socketRef.current?.off('orderStatusUpdate', callback); };
  };

  // Driver: escuchar cuando el admin le asigna un pedido (status preparing)
  const onOrderAssigned = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderAssigned', callback);
    return () => { socketRef.current?.off('orderAssigned', callback); };
  };

  // Admin: escuchar cuando el driver pasa a 'on_the_way'
  const onOrderStatusUpdateAdmin = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderStatusUpdateAdmin', callback);
    return () => { socketRef.current?.off('orderStatusUpdateAdmin', callback); };
  };

  // === Flujo completo de órdenes (eventos por paso) ===
  // Admin: nueva orden creada por cliente
  const onNewOrderCreated = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('newOrderCreated', callback);
    return () => { socketRef.current?.off('newOrderCreated', callback); };
  };
  // Admin: driver va al restaurante
  const onDriverHeadingToRestaurant = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('driverHeadingToRestaurant', callback);
    return () => { socketRef.current?.off('driverHeadingToRestaurant', callback); };
  };
  // Cliente: driver llegó al restaurante (disparar apertura de mapa en tiempo real)
  const onDriverArrivedAtRestaurant = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('driverArrivedAtRestaurant', callback);
    return () => { socketRef.current?.off('driverArrivedAtRestaurant', callback); };
  };
  // Admin y Cliente: pedido en camino al domicilio
  const onOrderOnTheWay = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderOnTheWay', callback);
    return () => { socketRef.current?.off('orderOnTheWay', callback); };
  };
  // Admin y Driver: cliente confirmó la entrega
  const onOrderCompleted = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderCompleted', callback);
    return () => { socketRef.current?.off('orderCompleted', callback); };
  };
  // Driver: pedido listo para recoger en restaurante
  const onOrderReadyForPickup = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderReadyForPickup', callback);
    return () => { socketRef.current?.off('orderReadyForPickup', callback); };
  };
  // Cliente: pedido entregado por el driver
  const onOrderDelivered = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderDelivered', callback);
    return () => { socketRef.current?.off('orderDelivered', callback); };
  };

  // Cliente: cualquier cambio de estado del pedido (para sincronizar lista sin polling)
  const onOrderStatusChanged = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderStatusChanged', callback);
    return () => { socketRef.current?.off('orderStatusChanged', callback); };
  };

  // Driver: pedido cancelado (por cliente o admin) → sacar de la lista de pedidos activos
  const onOrderCancelled = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderCancelled', callback);
    return () => { socketRef.current?.off('orderCancelled', callback); };
  };

   // Driver: pedido reasignado a otro → ya no debe verlo ni operarlo
  const onOrderReassignedAway = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderReassignedAway', callback);
    return () => { socketRef.current?.off('orderReassignedAway', callback); };
  };

  // Driver: pedido reasignado hacia este driver (nuevo dueño del pedido)
  const onOrderReassignedToYou = (callback) => {
    if (!socketRef.current) return;
    socketRef.current.on('orderReassignedToYou', callback);
    return () => { socketRef.current?.off('orderReassignedToYou', callback); };
  };

  // Función para que el admin se una al canal de tracking general
  const joinAdminTracking = () => {
    if (!socketRef.current || !isConnected) return;

    if (user?.role === 'admin') {
      socketRef.current.emit('joinAdminTracking');
      console.log('📍 Admin unido al tracking general de drivers');
    }
  };

  // Valor del contexto
  const value = {
    socket: socketRef.current,
    isConnected,
    currentOrderRoom,
    joinOrderRoom,
    leaveOrderRoom,
    updateDriverLocation,
    onDriverLocationUpdate,
    onDriverLocationBroadcast,
    onVerificationUpdate,
    onOrderStatusUpdate,
    onOrderAssigned,
    onOrderStatusUpdateAdmin,
    onNewOrderCreated,
    onDriverHeadingToRestaurant,
    onDriverArrivedAtRestaurant,
    onOrderOnTheWay,
    onOrderCompleted,
    onOrderReadyForPickup,
    onOrderDelivered,
    onOrderStatusChanged,
    onOrderCancelled,
    onOrderReassignedAway,
    onOrderReassignedToYou,
    joinAdminTracking,
    reconnect: connectSocket,
    disconnect: disconnectSocket
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};