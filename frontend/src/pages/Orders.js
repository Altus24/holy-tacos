// Página de pedidos del usuario en Holy Tacos con tracking en tiempo real
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import CancelOrderModal from '../components/CancelOrderModal';
import axios from 'axios';

const Orders = () => {
  const { user, isAuthenticated } = useAuth();
  const { onOrderDelivered, onOrderStatusChanged } = useSocket();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);

  // Estados para la cancelación de pedidos
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [expandedCompletedOrderId, setExpandedCompletedOrderId] = useState(null); // dropdown pedidos completados

  // Función para obtener pedidos del usuario
  const fetchOrders = async () => {
    try {
      const response = await axios.get('/api/orders');
      if (response.data.success) {
        const newOrders = response.data.data;

        // Verificar si hay cambios en los pedidos para mostrar notificaciones
        if (orders.length > 0 && newOrders.length > 0) {
          checkForStatusChanges(orders, newOrders);
        }

        setOrders(newOrders);
        setLastUpdate(new Date());
        setError('');
      }
    } catch (error) {
      console.error('Error al obtener pedidos:', error);
      setError('Error al cargar pedidos. Inténtalo nuevamente.');
    }
  };

  // Función para verificar cambios de estado y mostrar notificaciones
  const checkForStatusChanges = (oldOrders, newOrders) => {
    newOrders.forEach(newOrder => {
      const oldOrder = oldOrders.find(o => o._id === newOrder._id);
      if (oldOrder && oldOrder.status !== newOrder.status) {
        // Mostrar notificación de cambio de estado
        showStatusChangeNotification(newOrder, oldOrder.status, newOrder.status);
      }
    });
  };

  // Función para mostrar notificaciones de cambio de estado
  const showStatusChangeNotification = (order, oldStatus, newStatus) => {
    const statusMessages = {
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
      cancelled_by_admin: 'Cancelado por admin'
    };

    const message = `¡Pedido #${order._id.slice(-6)} actualizado!\nEstado anterior: ${statusMessages[oldStatus]}\nNuevo estado: ${statusMessages[newStatus]}`;

    // Mostrar notificación con alert (podría mejorarse con un sistema de notificaciones más sofisticado)
    setTimeout(() => {
      alert(message);
    }, 500);
  };

  // Función para simular ubicación del conductor
  const getDriverLocation = (order) => {
    if (order.status === 'on_the_way') {
      // Simular diferentes ubicaciones según el tiempo transcurrido
      const locations = [
        'Saliendo del restaurante',
        'En camino a tu dirección',
        'A 5 minutos de tu ubicación',
        'Muy cerca de tu dirección',
        'Llegando en 2 minutos'
      ];

      // Usar el ID del pedido para generar una ubicación consistente
      const locationIndex = order._id.charCodeAt(order._id.length - 1) % locations.length;
      return locations[locationIndex];
    }
    return null;
  };

  // Función para obtener el tiempo estimado de entrega
  const getEstimatedTime = (order) => {
    const statusTimes = {
      pending: '15-25 min',
      assigned: '15-25 min',
      heading_to_restaurant: '10-20 min',
      ready_for_pickup: '5-15 min',
      at_restaurant: 'En el restaurante',
      on_the_way: '2-10 min',
      delivered: 'Entregado',
      completed: 'Completado',
      cancelled: 'Cancelado',
      cancelled_by_client: 'Cancelado',
      cancelled_by_admin: 'Cancelado'
    };
    return statusTimes[order.status] || '—';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      heading_to_restaurant: 'bg-indigo-100 text-indigo-800',
      ready_for_pickup: 'bg-purple-100 text-purple-800',
      at_restaurant: 'bg-amber-100 text-amber-800',
      on_the_way: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      completed: 'bg-green-200 text-green-900',
      cancelled: 'bg-red-100 text-red-800',
      cancelled_by_client: 'bg-red-100 text-red-700',
      cancelled_by_admin: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const texts = {
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
      cancelled_by_admin: 'Cancelado por el restaurante'
    };
    return texts[status] || status;
  };

  // Determinar si un pedido se puede cancelar (no está en estado final)
  const isCancellable = (order) => {
    const estadosFinales = [
      'delivered', 'completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_client_with_penalty',
      'cancelled_by_admin', 'cancelled_by_admin_with_penalty'
    ];
    return !estadosFinales.includes(order.status);
  };

  // Abrir modal de cancelación
  const handleOpenCancelModal = (order) => {
    setSelectedOrder(order);
    setCancelModalOpen(true);
    setCancelMessage(null);
  };

  // Cerrar modal de cancelación
  const handleCloseCancelModal = () => {
    setCancelModalOpen(false);
    setSelectedOrder(null);
  };

  // Confirmar cancelación del pedido
  const handleConfirmCancel = useCallback(async (reason) => {
    if (!selectedOrder) return;

    setCancelLoading(true);
    setCancelMessage(null);

    try {
      const response = await axios.put(`/api/orders/${selectedOrder._id}/cancel`, {
        cancellationReason: reason
      });

      if (response.data.success) {
        // Actualizar el pedido en la lista local sin recargar toda la página
        setOrders(prevOrders =>
          prevOrders.map(o =>
            o._id === selectedOrder._id ? response.data.data : o
          )
        );

        // Mostrar mensaje de éxito
        setCancelMessage({
          type: 'success',
          text: response.data.message
        });

        // Cerrar modal
        setCancelModalOpen(false);
        setSelectedOrder(null);

        // Limpiar mensaje después de 8 segundos
        setTimeout(() => setCancelMessage(null), 8000);
      }
    } catch (err) {
      console.error('Error al cancelar pedido:', err);
      const errorMsg = err.response?.data?.message || 'Error al cancelar el pedido. Inténtalo nuevamente.';
      setCancelMessage({
        type: 'error',
        text: errorMsg
      });
    } finally {
      setCancelLoading(false);
    }
  }, [selectedOrder]);

  // Cargar pedidos solo al montar; las actualizaciones llegan por socket (sin polling)
  useEffect(() => {
    if (isAuthenticated()) {
      fetchOrders();
    }
    setLoading(false);
  }, [isAuthenticated]);

  // Sincronizar lista solo cuando hay cambios reales (eventos en tiempo real)
  useEffect(() => {
    const unDelivered = onOrderDelivered?.((payload) => {
      toast.success(payload?.message || '¡Tu pedido llegó! Confirma la recepción para completar.', { duration: 6000 });
      fetchOrders();
    });
    const unStatusChanged = onOrderStatusChanged?.(() => {
      fetchOrders();
    });
    return () => {
      if (unDelivered) unDelivered();
      if (unStatusChanged) unStatusChanged();
    };
  }, [onOrderDelivered, onOrderStatusChanged]);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <BackButton to="/" label="Volver al Inicio" variant="link" />
          </div>
          {/* Encabezado */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Mis Pedidos
            </h1>
            <p className="text-gray-600 mt-2">
              Aquí puedes ver el historial y estado de todos tus pedidos.
            </p>
          </div>

          {/* Hora de la última actualización (solo cuando llegan cambios por tiempo real) */}
          {lastUpdate && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
              <p className="text-green-800 text-sm flex items-center">
                <span className="mr-2">🔄</span>
                Última actualización: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          )}

          {/* Mensaje de resultado de cancelación */}
          {cancelMessage && (
            <div className={`border rounded-lg p-4 mb-6 flex items-start ${
              cancelMessage.type === 'success'
                ? 'bg-green-50 border-green-300 text-green-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}>
              <div className="flex-shrink-0 mr-3 mt-0.5">
                {cancelMessage.type === 'success' ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{cancelMessage.text}</p>
              </div>
              {/* Botón para cerrar el mensaje */}
              <button
                onClick={() => setCancelMessage(null)}
                className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              {error}
            </div>
          )}

          {/* Estado de pedidos */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              <p className="mt-4 text-gray-600">Cargando tus pedidos...</p>
            </div>
          ) : !isAuthenticated() ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Acceso requerido
              </h3>
              <p className="text-gray-600 mb-6">
                Debes iniciar sesión para ver tus pedidos.
              </p>
              <div className="space-x-4">
                <Link
                  to="/login"
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/register"
                  className="border border-orange-600 text-orange-600 px-6 py-3 rounded-lg hover:bg-orange-50 transition-colors font-medium"
                >
                  Registrarse
                </Link>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No tienes pedidos aún
              </h3>
              <p className="text-gray-600 mb-6">
                ¡Es hora de hacer tu primer pedido! Explora nuestros restaurantes
                y descubre platillos deliciosos.
              </p>
              <Link
                to="/restaurants"
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Explorar Restaurantes
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map(order => {
                const isCompleted = order.status === 'completed';
                const isExpanded = expandedCompletedOrderId === order._id;

                // Pedidos completados: dropdown cerrado por defecto (entregado en barrio/dirección)
                if (isCompleted) {
                  return (
                    <div key={order._id} className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setExpandedCompletedOrderId(isExpanded ? null : order._id)}
                        className="w-full bg-gray-50 px-6 py-4 flex justify-between items-center text-left hover:bg-gray-100 transition-colors border-b border-gray-200"
                      >
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Pedido #{order._id.slice(-6)} • {order.restaurantId?.name || 'Restaurante'}
                          </h3>
                          <p className="text-sm text-gray-600 mt-0.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                              {getStatusText(order.status)}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : new Date(order.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-gray-400 flex-shrink-0 ml-2">
                          <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="p-6 border-t border-gray-100">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500">Pedido realizado: {new Date(order.createdAt).toLocaleString()}</p>
                            <div className="flex space-x-2">
                              {order.status === 'completed' && !order.driverRating?.stars && !order.restaurantRating?.stars && (
                                <Link to={`/rate/${order._id}`} className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 text-sm font-medium">⭐ Calificar ahora</Link>
                              )}
                              <Link to={`/restaurant/${order.restaurantId?._id}`} className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 text-sm font-medium">Reordenar</Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                <div key={order._id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Encabezado del pedido */}
                  <div className="bg-gray-50 px-6 py-4 border-b">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Pedido #{order._id.slice(-6)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {order.restaurantId?.name || 'Restaurante'} • {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        {order.paymentStatus && order.paymentStatus !== 'paid' && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 mb-1">
                            {order.paymentStatus === 'pending' ? 'Pago pendiente' : order.paymentStatus === 'failed' ? 'Pago fallido' : 'Pago: ' + order.paymentStatus}
                          </span>
                        )}
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                        <p className="text-sm text-gray-600 mt-1">
                          Tiempo estimado: {getEstimatedTime(order)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contenido: solo estado, tracking y acciones */}
                  <div className="p-6">
                    {/* Tracking en tiempo real para pedidos activos */}
                    {(order.status === 'assigned' || order.status === 'heading_to_restaurant' ||
                      order.status === 'ready_for_pickup' || order.status === 'at_restaurant' || order.status === 'on_the_way') && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                          <span className="mr-2">🚚</span>
                          Seguimiento en tiempo real
                        </h4>

                        {order.status === 'on_the_way' && getDriverLocation(order) && (
                          <div className="flex items-center text-blue-800">
                            <span className="mr-2">📍</span>
                            <span>{getDriverLocation(order)}</span>
                          </div>
                        )}

                        {order.driverId && (
                          <div className="mt-3 flex items-center gap-3">
                            {/* Avatar del conductor */}
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
                            <div className="text-sm text-blue-800">
                              <p className="font-medium">
                                Conductor asignado:{' '}
                                {order.driverId.name || order.driverId.email}
                              </p>
                              <p className="text-xs text-blue-700">
                                Verás su ubicación cuando esté en camino.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-blue-600 mt-2">
                          Última actualización: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Cargando...'}
                        </div>
                      </div>
                    )}

                    {/* Información de cancelación (si fue cancelado por cliente o admin) */}
                    {(order.status === 'cancelled_by_client' || order.status === 'cancelled_by_client_with_penalty' ||
                      order.status === 'cancelled_by_admin' || order.status === 'cancelled_by_admin_with_penalty') && (
                      <div className={`rounded-lg p-4 mb-6 border ${
                        (order.status === 'cancelled_by_client_with_penalty' || order.status === 'cancelled_by_admin_with_penalty')
                          ? 'bg-red-50 border-red-300'
                          : 'bg-gray-50 border-gray-300'
                      }`}>
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                          <svg className="w-5 h-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Pedido cancelado
                        </h4>

                        {/* Mostrar desglose de penalidad si aplica */}
                        {(order.status === 'cancelled_by_client_with_penalty' || order.status === 'cancelled_by_admin_with_penalty') && (
                          <div className="space-y-1 text-sm mb-2">
                            <div className="flex justify-between">
                              <span className="text-red-600">Penalidad retenida (10%):</span>
                              <span className="font-semibold text-red-700">${order.penaltyAmount?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-700">Reembolso estimado:</span>
                              <span className="font-semibold text-green-700">${order.refundAmount?.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {/* Mostrar motivo de cancelación si existe */}
                        {order.cancellationReason && (
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Motivo:</span> {order.cancellationReason}
                          </p>
                        )}

                        {/* Fecha de cancelación */}
                        {order.cancelledAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Cancelado el: {new Date(order.cancelledAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Acciones disponibles */}
                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        Pedido realizado: {new Date(order.createdAt).toLocaleString()}
                      </div>

                      <div className="flex space-x-2">
                        {/* Completar pago: pedidos con pago pendiente */}
                        {order.paymentStatus === 'pending' && (
                          <Link
                            to={`/checkout?orderId=${order._id}`}
                            className="flex items-center bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors text-sm font-medium"
                          >
                            💳 Completar pago
                          </Link>
                        )}

                        {/* Botón para cancelar pedido (visible si el pedido es cancelable) */}
                        {isCancellable(order) && (
                          <button
                            onClick={() => handleOpenCancelModal(order)}
                            className="flex items-center bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancelar Pedido
                          </button>
                        )}

                        {/* Botón para ver tracking en tiempo real */}
                        {(order.status === 'assigned' || order.status === 'heading_to_restaurant' ||
                          order.status === 'ready_for_pickup' || order.status === 'at_restaurant' || order.status === 'on_the_way') && (
                          <Link
                            to={`/orders/${order._id}`}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            📍 Ver Tracking
                          </Link>
                        )}

                        {/* Confirmar recepción: solo cuando el driver marcó entregado */}
                        {order.status === 'delivered' && (
                          <Link
                            to={`/orders/${order._id}`}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            ✓ Confirmar recepción
                          </Link>
                        )}

                        {/* Calificar: pedidos completados que aún no tienen calificación */}
                        {order.status === 'completed' && !order.driverRating?.stars && !order.restaurantRating?.stars && (
                          <Link
                            to={`/rate/${order._id}`}
                            className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 transition-colors text-sm font-medium"
                          >
                            ⭐ Calificar ahora
                          </Link>
                        )}

                        {/* Botón para contactar soporte si hay problemas */}
                        {(order.status === 'cancelled' || order.status === 'cancelled_by_client' ||
                          order.status === 'cancelled_by_client_with_penalty' ||
                          order.status === 'cancelled_by_admin' || order.status === 'cancelled_by_admin_with_penalty') && (
                          <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                            Contactar Soporte
                          </button>
                        )}

                        {/* Botón para reordenar si está completado */}
                        {(order.status === 'delivered' || order.status === 'completed') && (
                          <Link
                            to={`/restaurant/${order.restaurantId?._id}`}
                            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors text-sm font-medium"
                          >
                            Reordenar
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}

          {/* Información adicional */}
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              💡 Consejos para tus pedidos
            </h3>
            <ul className="text-blue-800 space-y-1">
              <li>• Realiza tus pedidos con anticipación para mejor disponibilidad</li>
              <li>• Puedes rastrear tu pedido en tiempo real</li>
              <li>• Si tienes problemas, contacta nuestro soporte</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal de cancelación de pedido */}
      <CancelOrderModal
        isOpen={cancelModalOpen}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancel}
        order={selectedOrder}
        isLoading={cancelLoading}
      />
    </Layout>
  );
};

export default Orders;