// Página de detalle de pedido para conductores en Holy Tacos
// Permite seguimiento GPS, actualización de estado y comunicación en tiempo real
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import MapTracker from '../components/MapTracker';
import OrderStatusNotification from '../components/driver/OrderStatusNotification';
import axios from 'axios';

const DriverOrderDetail = () => {
  const { orderId } = useParams();
  const { user } = useAuth();
  const { joinOrderRoom, updateDriverLocation, leaveOrderRoom, onOrderCancelled, onOrderReassignedAway } = useSocket();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState('unknown');
  const [isTracking, setIsTracking] = useState(false);

  // Referencias para geolocalización
  const watchIdRef = useRef(null);
  const locationIntervalRef = useRef(null);

  // Cargar detalles del pedido
  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  // Configurar seguimiento GPS cuando el pedido esté en proceso de entrega
  useEffect(() => {
    if (order &&
        (order.status === 'at_restaurant' || order.status === 'on_the_way') &&
        order.driverId && (order.driverId._id === user._id || order.driverId === user._id)) {
      startLocationTracking();
    }
    return () => { stopLocationTracking(); };
  }, [order, user._id]);

  useEffect(() => {
    if (order && orderId) {
      joinOrderRoom(orderId);
      return () => { leaveOrderRoom(); };
    }
  }, [order, orderId, joinOrderRoom, leaveOrderRoom]);

  // Escuchar cancelación del pedido en tiempo real para este driver
  useEffect(() => {
    if (!onOrderCancelled || !orderId) return;
    const cleanup = onOrderCancelled((payload) => {
      if (!payload?.orderId) return;
      if (String(payload.orderId) === String(orderId)) {
        // Marcar error y redirigir al listado de pedidos del driver
        setError(payload.message || 'Este pedido fue cancelado y ya no está asignado a vos.');
        setTimeout(() => navigate('/driver/orders'), 2500);
      }
    });
    return () => { if (cleanup) cleanup(); };
  }, [onOrderCancelled, orderId, navigate]);

  // Escuchar reasignación del pedido (ya no pertenece a este driver)
  useEffect(() => {
    if (!onOrderReassignedAway || !orderId) return;
    const cleanup = onOrderReassignedAway((payload) => {
      if (!payload?.orderId) return;
      if (String(payload.orderId) === String(orderId)) {
        setError(payload.message || 'Este pedido fue reasignado a otro conductor y ya no está asignado a vos.');
        setTimeout(() => navigate('/driver/orders'), 2500);
      }
    });
    return () => { if (cleanup) cleanup(); };
  }, [onOrderReassignedAway, orderId, navigate]);

  // Escuchar cuando el admin marca "Pedido listo" (ready_for_pickup)
  const { onOrderReadyForPickup } = useSocket();
  useEffect(() => {
    if (!order || !onOrderReadyForPickup) return;
    const cleanup = onOrderReadyForPickup?.((payload) => {
      if (payload?.orderId === orderId || String(payload?.orderId) === orderId) {
        setOrder(prev => (prev ? { ...prev, status: 'ready_for_pickup' } : prev));
      }
    });
    return () => { if (cleanup) cleanup(); };
  }, [orderId, onOrderReadyForPickup]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/orders/${orderId}`);

      if (response.data.success) {
        const orderData = response.data.data;

        // Permitir ver si: pedido pendiente sin conductor (para aceptar) o asignado a este driver
        const driverId = orderData.driverId?._id || orderData.driverId;
        if (driverId && driverId.toString() !== user._id.toString()) {
          setError('No tenés permisos para ver este pedido');
          setLoading(false);
          return;
        }

        setOrder(orderData);
      } else {
        setError('Pedido no encontrado');
      }
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      setError('Error al cargar los detalles del pedido');
    } finally {
      setLoading(false);
    }
  };

  // Función para iniciar seguimiento de ubicación
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por este navegador');
      return;
    }

    // Solicitar permisos
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setLocationPermission(result.state);

      if (result.state === 'denied') {
        setError('Permisos de ubicación denegados. Habilita la ubicación para continuar.');
        return;
      }

      // Configurar opciones de geolocalización de alta precisión
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000 // Cache de 30 segundos
      };

      // Iniciar watchPosition para seguimiento continuo
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };

          setCurrentLocation(location);
          setIsTracking(true);
          setLocationPermission('granted');

          console.log('📍 Ubicación obtenida:', location);
        },
        (error) => {
          console.error('Error de geolocalización:', error);
          setIsTracking(false);

          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationPermission('denied');
              setError('Permisos de ubicación denegados');
              break;
            case error.POSITION_UNAVAILABLE:
              setError('Ubicación no disponible');
              break;
            case error.TIMEOUT:
              setError('Tiempo agotado para obtener ubicación');
              break;
            default:
              setError('Error desconocido de geolocalización');
          }
        },
        options
      );

      // Enviar ubicación al backend y a los clientes cada ~5 segundos mientras el pedido esté en proceso
      locationIntervalRef.current = setInterval(() => {
        if (currentLocation && (order?.status === 'at_restaurant' || order?.status === 'on_the_way')) {
          updateDriverLocation(orderId, currentLocation.lat, currentLocation.lng);
        }
      }, 5000);

    }).catch((error) => {
      console.error('Error al consultar permisos:', error);
    });
  };

  // Función para detener seguimiento de ubicación
  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    setIsTracking(false);
  };

  const updateOrderStatus = async (newStatus) => {
    try {
      setUpdating(true);
      const response = await axios.put(`/api/orders/${orderId}/status`, { status: newStatus });
      if (response.data.success) {
        setOrder(prev => ({ ...prev, ...response.data.data }));
        if (newStatus === 'delivered') {
          stopLocationTracking();
          setTimeout(() => navigate('/driver/orders'), 2000);
        }
      }
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert(err.response?.data?.message || 'Error al actualizar el estado');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      assigned: 'Asignado',
      heading_to_restaurant: 'Yendo al restaurante',
      ready_for_pickup: 'Listo para recoger',
      at_restaurant: 'En el restaurante',
      on_the_way: 'En camino a entregar',
      delivered: 'Entregado',
      completed: 'Completado',
      cancelled: 'Cancelado',
      cancelled_by_driver: 'Cancelado por conductor'
    };
    return statusMap[status] || status;
  };

  // Botones secuenciales: Aceptar pedido → Voy a recoger → Llegué al restaurante → Voy a entregar → Entregado
  const getAvailableActions = () => {
    const status = order?.status;
    if (status === 'assigned') return [{ status: 'heading_to_restaurant', label: '🚗 Aceptar pedido y voy en camino a recoger', color: 'bg-blue-600 hover:bg-blue-700' }];
    if (status === 'ready_for_pickup') return [{ status: 'at_restaurant', label: '🏪 Llegué al restaurante', color: 'bg-amber-600 hover:bg-amber-700' }];
    if (status === 'at_restaurant') return [{ status: 'on_the_way', label: '🚚 Voy en camino a entregar', color: 'bg-orange-600 hover:bg-orange-700' }];
    if (status === 'on_the_way') return [{ status: 'delivered', label: '✅ Marcar como Entregado', color: 'bg-green-600 hover:bg-green-700' }];
    return [];
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando detalles del pedido...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              to="/driver/orders"
              className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Ver Mis Pedidos
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Pedido no encontrado</h2>
            <Link
              to="/driver/orders"
              className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Ver Mis Pedidos
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <OrderStatusNotification />
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <BackButton to="/driver/orders" label="Volver a Mis Pedidos" variant="link" />
          </div>
          {/* Encabezado */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Pedido #{orderId.slice(-6)}
                </h1>
                <p className="text-gray-600 mt-2">
                  Cliente: {order.userId?.email || 'N/A'} • Restaurante: {order.restaurantId?.name || 'N/A'}
                </p>
              </div>

              {/* Estado del pedido */}
              <div className="bg-white px-4 py-3 rounded-lg shadow border-2 border-orange-300">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    Estado: {getStatusText(order.status)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Actualizado: {new Date(order.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Información de GPS */}
          <div className="mb-6">
            <div className={`p-4 rounded-lg border ${
              locationPermission === 'granted' && isTracking
                ? 'bg-green-50 border-green-300'
                : locationPermission === 'denied'
                ? 'bg-red-50 border-red-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">
                    {locationPermission === 'granted' && isTracking ? '📍' :
                     locationPermission === 'denied' ? '🚫' : '⚠️'}
                  </span>
                  <div>
                    <p className="font-medium">
                      {locationPermission === 'granted' && isTracking
                        ? 'GPS Activo - Compartiendo ubicación'
                        : locationPermission === 'denied'
                        ? 'GPS Deshabilitado'
                        : 'Esperando permisos de GPS'}
                    </p>
                    {currentLocation && (
                      <p className="text-sm text-gray-600">
                        Precisión: ±{Math.round(currentLocation.accuracy)}m
                      </p>
                    )}
                  </div>
                </div>

                {locationPermission === 'denied' && (
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors text-sm"
                  >
                    Reintentar GPS
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Mapa principal */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <span className="mr-2">🗺️</span>
                    Mapa de Ruta
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.status === 'on_the_way'
                      ? 'Tu ubicación se comparte en tiempo real con el cliente'
                      : 'El mapa mostrará tu ruta cuando marques "Voy en camino a entregar"'}
                  </p>
                </div>

                <div className="p-4">
                  <MapTracker
                    restaurantAddress={order.restaurantId?.address}
                    deliveryAddress={order.deliveryAddress}
                    driverLocation={currentLocation}
                    showRoute={order.status === 'on_the_way'}
                    showETA={order.status === 'on_the_way'}
                  />
                </div>
              </div>
            </div>

            {/* Panel lateral */}
            <div className="space-y-6">
              {/* Información del cliente y entrega */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">👤</span>
                  Información de Entrega
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Cliente</p>
                    <p className="font-medium">{order.userId?.email || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Dirección de entrega</p>
                    <p className="font-medium">{order.deliveryAddress}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Restaurante</p>
                    <p className="font-medium">{order.restaurantId?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-500">{order.restaurantId?.address}</p>
                  </div>

                  {/* Palabra de seguridad compartida (solo visible para el driver) */}
                  {order.safetyWord && (
                    <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                      <p className="text-sm text-gray-700 font-medium">
                        Palabra de seguridad con el cliente:
                      </p>
                      <p className="mt-1 text-lg font-bold text-orange-700 uppercase tracking-wide">
                        {order.safetyWord}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Al entregar, pedile al cliente que te diga esta palabra para confirmar que es la persona correcta.
                      </p>
                    </div>
                  )}

                  {order.notes && (
                    <div>
                      <p className="text-sm text-gray-600">Notas especiales</p>
                      <p className="font-medium text-orange-600">{order.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items del pedido */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📦</span>
                  Items del Pedido
                </h3>

                <div className="space-y-2">
                  {order.items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <div>
                        <span className="font-medium">{item.quantity}x</span>
                        <span className="ml-2">{item.name}</span>
                        {item.description && (
                          <p className="text-xs text-gray-500">{item.description}</p>
                        )}
                      </div>
                      <span className="font-medium">${item.subtotal}</span>
                    </div>
                  ))}

                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal:</span>
                      <span>${order.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Entrega:</span>
                      <span>${order.deliveryFee}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg mt-2">
                      <span>Total:</span>
                      <span className="text-orange-600">${order.total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acciones disponibles */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">⚡</span>
                  Acciones
                </h3>

                <div className="space-y-3">
                  {getAvailableActions().map((action, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // Confirmación explícita al aceptar pedido recién asignado
                        if (order.status === 'assigned' && action.status === 'heading_to_restaurant') {
                          const ok = window.confirm('¿Querés aceptar este pedido y empezar a ir al restaurante?');
                          if (!ok) return;
                        }
                        updateOrderStatus(action.status);
                      }}
                      disabled={updating || locationPermission === 'denied'}
                      className={`w-full ${action.color} text-white py-3 px-4 rounded-lg transition-colors font-medium ${
                        updating ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {updating ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Actualizando...
                        </div>
                      ) : (
                        action.label
                      )}
                    </button>
                  ))}

                  {(order.status === 'picked_up' || order.status === 'on_the_way') && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-sm text-blue-800">
                        🚚 Estás compartiendo tu ubicación en tiempo real con el cliente.
                        Mantén la app abierta para actualizaciones precisas.
                      </p>
                    </div>
                  )}

                  <BackButton
                    to="/driver/orders"
                    label="Volver a Mis Pedidos"
                    className="w-full justify-center py-3"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DriverOrderDetail;