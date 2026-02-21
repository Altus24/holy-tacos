// Página de seguimiento de pedidos para clientes en Holy Tacos
// Muestra mapa en tiempo real con ubicación del driver y ruta estimada
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import MapTracker from '../components/MapTracker';
import MapWithThreeMarkers from '../components/MapWithThreeMarkers';
import axios from 'axios';

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const {
    joinOrderRoom,
    onDriverLocationUpdate,
    leaveOrderRoom,
    onOrderOnTheWay,
    onOrderDelivered,
    onOrderStatusChanged,
    onDriverArrivedAtRestaurant
  } = useSocket();

  const [order, setOrder] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapAutoOpened, setMapAutoOpened] = useState(false);

  // Cargar detalles del pedido
  useEffect(() => {
    if (orderId && isAuthenticated()) {
      loadOrderDetails();
    }
  }, [orderId, isAuthenticated]);

  // Unirse a la sala del pedido cuando se cargue
  useEffect(() => {
    if (order && orderId) {
      joinOrderRoom(orderId);

      const un1 = onDriverLocationUpdate?.((data) => {
        if (data.orderId === orderId) {
          setDriverLocation({ lat: data.lat, lng: data.lng });
          setLastUpdate(new Date(data.timestamp));
        }
      });
      const un2 = onOrderOnTheWay?.((payload) => {
        if (payload?.orderId === orderId || String(payload?.orderId) === orderId) {
          setOrder(prev => prev ? { ...prev, status: 'on_the_way' } : prev);
          toast.success(payload?.message || 'El pedido está en camino a tu domicilio');
        }
      });
      const un3 = onOrderDelivered?.((payload) => {
        if (payload?.orderId === orderId || String(payload?.orderId) === orderId) {
          setOrder(prev => prev ? { ...prev, status: 'delivered' } : prev);
          toast.success(payload?.message || '¡Tu pedido llegó! Confirma la recepción para completar.', { duration: 6000 });
        }
      });
      const un4 = onOrderStatusChanged?.((payload) => {
        if (!payload?.orderId) return;
        if (payload.orderId === orderId || String(payload.orderId) === String(orderId)) {
          setOrder(prev => prev ? { ...prev, status: payload.status } : prev);
        }
      });
      const un5 = onDriverArrivedAtRestaurant?.((payload) => {
        if (!payload?.orderId) return;
        if (payload.orderId === orderId || String(payload.orderId) === String(orderId)) {
          setOrder(prev => prev ? { ...prev, status: 'at_restaurant' } : prev);
          toast.success(payload?.message || 'El driver ya está en el restaurante. Podés seguirlo en el mapa.');
          setIsMapModalOpen(true);
          setMapAutoOpened(true);
        }
      });

      return () => {
        if (un1) un1();
        if (un2) un2();
        if (un3) un3();
        if (un4) un4();
        if (un5) un5();
        leaveOrderRoom();
      };
    }
  }, [
    order,
    orderId,
    joinOrderRoom,
    onDriverLocationUpdate,
    leaveOrderRoom,
    onOrderOnTheWay,
    onOrderDelivered,
    onOrderStatusChanged,
    onDriverArrivedAtRestaurant
  ]);

  // Abrir modal de mapa automáticamente cuando el pedido está listo o en estados posteriores
  useEffect(() => {
    if (!order) return;
    const status = order.status;
    const shouldShowMap =
      status === 'ready_for_pickup' ||
      status === 'at_restaurant' ||
      status === 'on_the_way' ||
      status === 'delivered';

    if (shouldShowMap && !mapAutoOpened) {
      setIsMapModalOpen(true);
      setMapAutoOpened(true);
    }
  }, [order, mapAutoOpened]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/orders/${orderId}`);

      if (response.data.success) {
        const orderData = response.data.data;

        // Verificar que el usuario sea el dueño del pedido
        if (orderData.userId._id !== user._id && user.role !== 'admin') {
          setError('No tienes permisos para ver este pedido');
          return;
        }

        setOrder(orderData);

        // Si el pedido tiene coordenadas guardadas, usarlas
        if (orderData.restaurantLocation) {
          // Las coordenadas ya están disponibles
        }

        // Si el pedido está siendo entregado, inicializar ubicación del driver
        if (orderData.status === 'picked_up' && orderData.driverId) {
          // La ubicación se actualizará en tiempo real vía socket
        }

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

  // Textos y colores del flujo: pending → assigned → heading_to_restaurant → ready_for_pickup → on_the_way → delivered → completed
  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Pendiente',
      assigned: 'En preparación',
      heading_to_restaurant: 'Driver yendo al restaurante',
      ready_for_pickup: 'Listo para recoger',
      at_restaurant: 'En el restaurante',
      on_the_way: 'En camino a tu domicilio',
      delivered: 'Entregado',
      completed: 'Completado',
      cancelled: 'Cancelado',
      cancelled_by_client: 'Cancelado por vos',
      cancelled_by_client_with_penalty: 'Cancelado (con penalidad)',
      cancelled_by_admin: 'Cancelado por el restaurante',
      cancelled_by_admin_with_penalty: 'Cancelado (con penalidad)'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      assigned: 'bg-blue-100 text-blue-800 border-blue-300',
      heading_to_restaurant: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      ready_for_pickup: 'bg-purple-100 text-purple-800 border-purple-300',
      at_restaurant: 'bg-amber-100 text-amber-800 border-amber-300',
      on_the_way: 'bg-orange-100 text-orange-800 border-orange-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      completed: 'bg-green-200 text-green-900 border-green-400',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      cancelled_by_client: 'bg-red-100 text-red-700 border-red-300',
      cancelled_by_admin: 'bg-red-100 text-red-700 border-red-300'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getEstimatedTime = (status) => {
    const timeMap = {
      pending: '15-25 min',
      assigned: '15-25 min',
      heading_to_restaurant: '10-20 min',
      ready_for_pickup: '5-15 min',
      at_restaurant: 'En el restaurante',
      on_the_way: '2-10 min',
      delivered: 'Entregado',
      completed: 'Completado',
      cancelled: 'Cancelado'
    };
    return timeMap[status] || '—';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      pending: '⏳',
      assigned: '✅',
      heading_to_restaurant: '🚗',
      ready_for_pickup: '🍕',
      at_restaurant: '🏪',
      on_the_way: '🚚',
      delivered: '🏠',
      completed: '✔️',
      cancelled: '❌'
    };
    return iconMap[status] || '📦';
  };

  const [confirming, setConfirming] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportOption, setReportOption] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [reportSending, setReportSending] = useState(false);

  const handleReportProblem = () => {
    setReportOption('');
    setReportDetail('');
    setReportModalOpen(true);
  };

  const handleSubmitReport = () => {
    setReportSending(true);
    setTimeout(() => {
      toast.success('Gracias. Soporte te contactará.');
      setReportModalOpen(false);
      setReportSending(false);
    }, 500);
  };

  const confirmDelivery = async () => {
    if (order?.status !== 'delivered') return;
    try {
      setConfirming(true);
      const res = await axios.put(`/api/orders/${orderId}/confirm-delivery`);
      if (res.data.success && res.data.data) {
        setOrder(res.data.data);
        toast.success('Recepción confirmada. Ahora califica tu experiencia.');
        navigate(`/rate/${orderId}`, { replace: true });
      }
      if (res.data.message && !res.data.data) toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al confirmar');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando seguimiento del pedido...</p>
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
              to="/orders"
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
              to="/orders"
              className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Ver Mis Pedidos
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Coordenadas del restaurante y del cliente (pueden venir del pedido)
  const restaurantLocation = order.restaurantLocation || null;
  const deliveryLocation = order.deliveryLocation || null;

  const canShowRealtimeMap =
    (restaurantLocation && deliveryLocation && driverLocation) &&
    ['ready_for_pickup', 'at_restaurant', 'on_the_way', 'delivered'].includes(order.status);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Botón volver a Mis Pedidos */}
          <div className="mb-4">
            <BackButton to="/orders" label="Volver a Mis Pedidos" variant="link" />
          </div>
          {/* Encabezado */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Seguimiento en Tiempo Real
                </h1>
                <p className="text-gray-600 mt-2">
                  Pedido #{orderId.slice(-6)} • {order.restaurantId?.name || 'Restaurante'}
                </p>
              </div>

              {/* Estado del pedido */}
              <div className={`px-4 py-2 rounded-lg border-2 ${getStatusColor(order.status)}`}>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getStatusIcon(order.status)}</span>
                  <span className="font-medium">{getStatusText(order.status)}</span>
                </div>
                <div className="text-sm mt-1">
                  Tiempo estimado: {getEstimatedTime(order.status)}
                </div>
              </div>
            </div>
          </div>

          {/* Información de actualización en tiempo real */}
          {lastUpdate && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
              <p className="text-green-800 text-sm flex items-center">
                <span className="mr-2">🔄</span>
                Última actualización del conductor: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Panel lateral con información */}
            <div className="space-y-6 lg:order-2">
              {/* Información del pedido */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📦</span>
                  Detalles del Pedido
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Restaurante</p>
                    <p className="font-medium">{order.restaurantId?.name || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Dirección de entrega</p>
                    <p className="font-medium">{order.deliveryAddress}</p>
                  </div>

                  {order.driverId && (
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                        {order.driverId.profilePicture ? (
                          <img
                            src={order.driverId.profilePicture}
                            alt={order.driverId.name || order.driverId.email}
                            className="h-9 w-9 object-cover"
                          />
                        ) : (
                          <span className="text-blue-700 font-semibold text-sm">
                            {(order.driverId.name || order.driverId.email || '?')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Conductor asignado</p>
                        <p className="font-medium">
                          {order.driverId.name || order.driverId.email}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Palabra de seguridad: visible cuando el conductor está de camino a entregar */}
                  {order.safetyWord && order.status === 'on_the_way' && (
                    <div className="mt-3 border border-orange-200 bg-orange-50 rounded-lg p-3">
                      <p className="text-sm text-gray-700 font-medium">
                        Palabra de seguridad para la entrega:
                      </p>
                      <p className="mt-1 text-lg font-bold text-orange-700 uppercase tracking-wide">
                        {order.safetyWord}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Cuando el conductor llegue, pedile que te confirme esta palabra para verificar que recibís el pedido correcto.
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-600">Items</p>
                    <div className="space-y-1 mt-1">
                      {order.items?.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{item.quantity}x {item.name}</span>
                          <span>${item.subtotal}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-orange-600">${order.total}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información del conductor */}
              {order.driverId && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">🚚</span>
                    Información del Conductor
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                        {order.driverId.profilePicture ? (
                          <img
                            src={order.driverId.profilePicture}
                            alt={order.driverId.name || order.driverId.email}
                            className="h-10 w-10 object-cover"
                          />
                        ) : (
                          <span className="text-blue-700 font-semibold text-sm">
                            {(order.driverId.name || order.driverId.email || '?')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Conductor</p>
                        <p className="font-medium">
                          {order.driverId.name || order.driverId.email}
                        </p>
                      </div>
                    </div>

                    {driverLocation && (
                      <div>
                        <p className="text-sm text-gray-600">Ubicación actual</p>
                        <p className="font-medium text-blue-600">
                          {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Actualizado: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Ahora'}
                        </p>
                      </div>
                    )}

                    {order.status === 'on_the_way' && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm text-blue-800">
                          💡 Tu pedido está en camino. El conductor llegará pronto a tu dirección.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Estado del pedido */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📊</span>
                  Estado del Pedido
                </h3>

                <div className="space-y-2">
                  {['pending', 'assigned', 'heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way', 'delivered', 'completed'].map((status, index) => {
                    const statusOrder = ['pending', 'assigned', 'heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way', 'delivered', 'completed'];
                    const isActive = order.status === status;
                    const isCompleted = statusOrder.indexOf(order.status) > statusOrder.indexOf(status);

                    return (
                      <div key={status} className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                          isCompleted ? 'bg-green-500 text-white' :
                          isActive ? 'bg-orange-500 text-white' :
                          'bg-gray-300 text-gray-600'
                        }`}>
                          {isCompleted ? '✓' : index + 1}
                        </div>
                        <span className={`text-sm ${
                          isCompleted ? 'text-green-700 font-medium' :
                          isActive ? 'text-orange-700 font-medium' :
                          'text-gray-500'
                        }`}>
                          {getStatusText(status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirmar recepción: solo cuando status = delivered (cliente dueño). Redirige a calificar. */}
              {order.status === 'delivered' && (order.userId?._id === user?._id || order.userId === user?._id) && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg shadow p-6">
                  <p className="text-base font-medium text-green-900 mb-2">¿Recibiste tu pedido?</p>
                  <p className="text-sm text-green-700 mb-4">Confirmá la recepción para completar y calificar al conductor y al restaurante.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={confirmDelivery}
                      disabled={confirming}
                      className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 shadow-md"
                    >
                      {confirming ? 'Confirmando...' : 'Confirmar recepción'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReportProblem}
                      className="flex-1 border border-red-400 text-red-700 py-3 px-4 rounded-lg hover:bg-red-50 transition-colors font-medium"
                    >
                      Reportar problema
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Reportar problema */}
              {reportModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Reportar problema</h3>
                    <p className="text-sm text-gray-600 mb-4">Seleccioná una opción o describí el problema. Soporte te contactará.</p>
                    <div className="space-y-2 mb-4">
                      {['No recibí el pedido', 'Pedido incompleto', 'Problema con el conductor', 'Otro'].map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="reportOption"
                            value={opt}
                            checked={reportOption === opt}
                            onChange={(e) => setReportOption(e.target.value)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={reportDetail}
                      onChange={(e) => setReportDetail(e.target.value)}
                      placeholder="Detalles (opcional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReportModalOpen(false)}
                        className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitReport}
                        disabled={reportSending}
                        className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                      >
                        {reportSending ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="bg-white rounded-lg shadow p-6">
                <Link
                  to="/orders"
                  className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors text-center block font-medium"
                >
                  Ver Todos Mis Pedidos
                </Link>
              </div>
            </div>
          </div>

          {/* CTA para abrir mapa en tiempo real */}
          <div className="mt-8">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 flex items-center">
                    <span className="mr-2">🗺️</span>
                    Mapa en tiempo real
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {canShowRealtimeMap
                      ? 'Seguimiento detallado desde el restaurante hasta tu domicilio.'
                      : 'El mapa se habilitará cuando el pedido esté listo o en camino.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(true)}
                  disabled={!canShowRealtimeMap}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium
                             bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-600
                             disabled:cursor-not-allowed transition-colors"
                >
                  Ver mapa en tiempo real
                </button>
              </div>
            </div>
          </div>

          {/* Modal de mapa en tiempo real */}
          {isMapModalOpen && (
            <div className="fixed inset-0 z-40 flex items-center justify-center px-3">
              <div
                className="absolute inset-0 bg-black bg-opacity-60"
                onClick={() => setIsMapModalOpen(false)}
              />
              <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <span className="mr-2">🗺️</span>
                      Seguimiento en tiempo real
                    </h2>
                    <p className="text-xs text-gray-600">
                      Restaurante → Driver → Tu dirección
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapModalOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 p-4">
                  {!canShowRealtimeMap ? (
                    <div className="h-full flex items-center justify-center text-center text-sm text-gray-600">
                      Aún no hay suficiente información para mostrar el mapa. Esperá a que el pedido esté listo o en camino.
                    </div>
                  ) : (
                    <MapWithThreeMarkers
                      restaurantLocation={restaurantLocation}
                      deliveryLocation={deliveryLocation}
                      driverLocation={driverLocation}
                      showRoute
                      showETA
                    />
                  )}
                </div>

                {canShowRealtimeMap && (
                  <div className="px-5 py-3 border-t bg-gray-50 text-xs text-gray-600">
                    {order.status === 'at_restaurant'
                      ? 'El driver ya está en el restaurante preparando tu entrega.'
                      : order.status === 'on_the_way'
                      ? 'El driver está en camino hacia tu dirección.'
                      : 'El pedido está casi listo para salir hacia tu dirección.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default OrderTracking;