// Página de pedidos para conductores en Holy Tacos con tracking en tiempo real
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import OrderStatusNotification from '../components/driver/OrderStatusNotification';
import axios from 'axios';

// Solo asignados: pendientes de que el driver haga clic en "En camino a recoger"
// En proceso: desde que el driver marca "En camino a recoger" hasta entregado (aún no completado por cliente)
const STATUS_EN_PROCESO = ['heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way', 'delivered'];

const DriverOrders = () => {
  const { user, refreshUser } = useAuth();
  const { onOrderAssigned, onOrderReadyForPickup, onOrderCancelled, onOrderReassignedAway, onOrderReassignedToYou, onOrderCompleted } = useSocket();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' | 'in_progress' | 'completed'
  const [expandedOrderId, setExpandedOrderId] = useState(null); // para dropdown de completados

  useEffect(() => {
    refreshUser?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notificaciones en tiempo real: asignación, pedido listo para recoger, pedido cancelado y reasignaciones
  useEffect(() => {
    const un1 = onOrderAssigned?.((payload) => {
      const shortId = payload?.orderId ? String(payload.orderId).slice(-6) : '';
      toast.success(payload?.message || `Te asignaron un nuevo pedido ${shortId ? `(#${shortId})` : ''}.`);
      loadDriverOrders();
    });
    const un2 = onOrderReadyForPickup?.(() => {
      toast.success('El pedido ya está listo para que lo recojas en el restaurante');
      loadDriverOrders();
    });
    const un3 = onOrderCancelled?.((payload) => {
      if (!payload?.orderId) return;
      // Remover pedido cancelado de la lista local inmediatamente
      setOrders(prev => prev.filter(o => o._id !== payload.orderId && String(o._id) !== String(payload.orderId)));
      toast.error(payload.message || 'Un pedido asignado a vos fue cancelado.');
      setLastUpdate(new Date());
    });
    const un4 = onOrderReassignedAway?.((payload) => {
      if (!payload?.orderId) return;
      // Remover el pedido reasignado a otro driver
      setOrders(prev => prev.filter(o => o._id !== payload.orderId && String(o._id) !== String(payload.orderId)));
      toast.error(payload.message || 'Un pedido asignado a vos fue reasignado a otro conductor.');
      setLastUpdate(new Date());
    });
    const un5 = onOrderReassignedToYou?.((payload) => {
      const shortId = payload?.orderId ? String(payload.orderId).slice(-6) : '';
      toast.success(payload?.message || `Te reasignaron un pedido ${shortId ? `(#${shortId})` : ''}.`);
      loadDriverOrders();
    });
    // Cliente confirmó recepción → pedido pasa a 'completed': sacar de asignados
    const un6 = onOrderCompleted?.((payload) => {
      const orderId = payload?.orderId;
      if (!orderId) return;
      setOrders(prev => prev.map(o => (o._id === orderId || String(o._id) === String(orderId)) ? { ...o, status: 'completed' } : o));
      toast.success(payload?.message || 'Entrega completada.');
      setLastUpdate(new Date());
    });
    return () => { if (un1) un1(); if (un2) un2(); if (un3) un3(); if (un4) un4(); if (un5) un5(); if (un6) un6(); };
  }, [onOrderAssigned, onOrderReadyForPickup, onOrderCancelled, onOrderReassignedAway, onOrderReassignedToYou, onOrderCompleted]);

  const handleOrderStatusUpdate = useCallback((orderId, newStatus) => {
    setOrders(prev => prev.map(o => (o._id === orderId ? { ...o, status: newStatus } : o)));
    setLastUpdate(new Date());
  }, []);

  const loadDriverOrders = async () => {
    try {
      const response = await axios.get('/api/orders');
      if (response.data.success) {
        setOrders(response.data.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para verificar cambios y mostrar notificaciones
  const checkForNewOrders = (newOrders) => {
    const newAssignedOrders = newOrders.filter(order =>
      order.driverId && order.driverId._id === user._id &&
      !orders.some(oldOrder => oldOrder._id === order._id)
    );

    if (newAssignedOrders.length > 0) {
      alert(`¡Tienes ${newAssignedOrders.length} nuevo(s) pedido(s) asignado(s)!`);
    }
  };

  // Cargar pedidos al montar; las actualizaciones llegan por socket (sin polling)
  useEffect(() => {
    loadDriverOrders();
  }, []);

  // Verificar nuevos pedidos cuando se actualice la lista
  useEffect(() => {
    if (orders.length > 0 && lastUpdate) {
      // Aquí podríamos comparar con el estado anterior para detectar nuevos pedidos
    }
  }, [orders]);

  // Actualizar estado del pedido
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setUpdatingOrder(orderId);
      const response = await axios.put(`/api/orders/${orderId}/status`, {
        status: newStatus
      });

      if (response.data.success) {
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order._id === orderId
              ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
              : order
          )
        );
        setLastUpdate(new Date());
        if (newStatus === 'heading_to_restaurant') setActiveTab('in_progress');
      }
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar el pedido');
    } finally {
      setUpdatingOrder(null);
    }
  };

  // Obtener pedidos por estado
  const getOrdersByStatus = (status) => {
    return orders.filter(order => order.status === status);
  };

  const getDriverLocation = (order) => {
    if (order.status === 'on_the_way') {
      // Simular diferentes ubicaciones según el tiempo transcurrido
      const timeSincePickup = Date.now() - new Date(order.updatedAt || order.createdAt).getTime();
      const minutesElapsed = Math.floor(timeSincePickup / (1000 * 60));

      const locations = [
        'Saliendo del restaurante con tu pedido',
        'En camino hacia tu dirección',
        `A ${Math.max(1, 10 - minutesElapsed)} minutos de tu ubicación`,
        'Muy cerca de tu dirección',
        'Llegando en 2 minutos',
        'Estoy en tu dirección'
      ];

      // Usar minutos transcurridos para determinar ubicación
      const locationIndex = Math.min(minutesElapsed, locations.length - 1);
      return locations[locationIndex];
    }
    return null;
  };

  const assignedOrders = orders.filter(o => o.status === 'assigned');
  const inProgressOrders = orders.filter(o => STATUS_EN_PROCESO.includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'completed');
  const listToShow = activeTab === 'assigned' ? assignedOrders : activeTab === 'in_progress' ? inProgressOrders : completedOrders;

  const getStatusText = (status) => {
    const statusMap = {
      'assigned': 'Asignado',
      'heading_to_restaurant': 'Yendo al restaurante',
      'ready_for_pickup': 'Listo para recoger',
      'at_restaurant': 'En el restaurante',
      'on_the_way': 'En camino a entregar',
      'delivered': 'Entregado',
      'completed': 'Completado',
      'cancelled': 'Cancelado',
      'cancelled_by_driver': 'Cancelado por conductor'
    };
    return statusMap[status] || status;
  };
  const getStatusColor = (status) => {
    const colorMap = {
      'assigned': 'bg-blue-100 text-blue-800',
      'heading_to_restaurant': 'bg-indigo-100 text-indigo-800',
      'ready_for_pickup': 'bg-purple-100 text-purple-800',
      'at_restaurant': 'bg-amber-100 text-amber-800',
      'on_the_way': 'bg-orange-100 text-orange-800',
      'delivered': 'bg-green-100 text-green-800',
      'completed': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800',
      'cancelled_by_driver': 'bg-red-100 text-red-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  // Botones secuenciales: Aceptar pedido → Voy a recoger → En el restaurante → Voy a entregar → Entregado
  const getNextActions = (order) => {
    const status = order?.status;
    const isMine = order?.driverId?._id === user?._id || order?.driverId === user?._id;
    if (!isMine) return [];
    if (status === 'assigned') return [{ label: 'Aceptar pedido y voy en camino a recoger', status: 'heading_to_restaurant' }];
    if (status === 'ready_for_pickup') return [{ label: 'Llegué al restaurante', status: 'at_restaurant' }];
    if (status === 'at_restaurant') return [{ label: 'Voy en camino a entregar', status: 'on_the_way' }];
    if (status === 'on_the_way') return [{ label: 'Entregado', status: 'delivered' }];
    return [];
  };

  // Datos de verificación
  const verificationStatus = user?.driverProfile?.verificationStatus;
  const verificationNotes = user?.driverProfile?.verificationNotes;

  return (
    <Layout>
      {/* Notificación en tiempo real cuando el admin marca "Preparando" */}
      <OrderStatusNotification onOrderUpdated={handleOrderStatusUpdate} />

      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <BackButton to="/" label="Volver al Inicio" variant="link" />
          </div>
          {/* Banner de verificación */}
          {verificationStatus === 'pending' && (
            <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 px-5 py-4 flex items-start gap-3">
              <span className="text-2xl mt-0.5">&#9888;</span>
              <div>
                <h3 className="font-semibold text-yellow-800">Cuenta pendiente de verificación</h3>
                <p className="text-yellow-700 text-sm mt-1">
                  Tu cuenta está pendiente de verificación por el administrador. No podés recibir pedidos hasta que sea aprobada.
                </p>
              </div>
            </div>
          )}

          {verificationStatus === 'rejected' && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-5 py-4 flex items-start gap-3">
              <span className="text-2xl mt-0.5">&#10060;</span>
              <div>
                <h3 className="font-semibold text-red-800">Verificación rechazada</h3>
                <p className="text-red-700 text-sm mt-1">
                  Tu verificación fue rechazada{verificationNotes ? `: "${verificationNotes}"` : '.'}
                  {' '}Por favor, revisá tus documentos y contactá al soporte.
                </p>
              </div>
            </div>
          )}

          {/* Encabezado */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Panel de Conductor
            </h1>
            <p className="text-gray-600 mt-2">
              Bienvenido, {user?.email}. Gestiona tus entregas activas.
            </p>

            {/* Hora de la última actualización (solo cuando llegan cambios por tiempo real) */}
            {lastUpdate && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-blue-800 text-sm flex items-center">
                  <span className="mr-2">🔄</span>
                  Última actualización: {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>

          {/* Pestañas: Asignados | En proceso | Completados */}
          <nav className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('assigned')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'assigned' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              📦 Asignados ({assignedOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'in_progress' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              🚚 En proceso ({inProgressOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'completed' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              ✅ Completados ({completedOrders.length})
            </button>
          </nav>

          {/* Lista de pedidos (según pestaña) */}
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando pedidos...</p>
              </div>
            ) : listToShow.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">
                  {activeTab === 'assigned' ? '📦' : activeTab === 'in_progress' ? '🚚' : '✅'}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {activeTab === 'assigned' && 'No hay pedidos asignados'}
                  {activeTab === 'in_progress' && 'No hay pedidos en proceso'}
                  {activeTab === 'completed' && 'No hay pedidos completados'}
                </h3>
                <p className="text-gray-600">
                  {activeTab === 'assigned' && 'Cuando tengas pedidos asignados por los administradores, aparecerán aquí.'}
                  {activeTab === 'in_progress' && 'Cuando aceptes un pedido y marques que vas en camino a recoger, aparecerá aquí.'}
                  {activeTab === 'completed' && 'Los pedidos que el cliente confirme como recibidos aparecerán aquí.'}
                </p>
              </div>
            ) : (
              listToShow.map(order => {
                const isCompleted = order.status === 'completed';
                const isExpanded = expandedOrderId === order._id;

                // Órdenes completadas: dropdown cerrado por defecto (nombre cliente + barrio/dirección)
                if (isCompleted) {
                  return (
                    <div key={order._id} className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}
                        className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">
                            {order.userId?.name || order.userId?.email || 'Cliente'}
                          </p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            Barrio / zona: {order.deliveryAddress || '—'}
                          </p>
                        </div>
                        <span className="text-gray-400 flex-shrink-0 ml-2">
                          <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-0 border-t border-gray-100">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold">Pedido #{order._id.slice(-6)}</h3>
                              <p className="text-gray-600">Restaurante: {order.restaurantId?.name || 'N/A'}</p>
                              <p className="text-gray-600">Dirección: {order.deliveryAddress}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                                {getStatusText(order.status)}
                              </span>
                              <p className="text-sm text-gray-500 mt-2">${order.total} total</p>
                            </div>
                          </div>
                          <div className="mb-4">
                            <h4 className="font-medium mb-2">Items del pedido:</h4>
                            <div className="space-y-1">
                              {order.items?.map((item, index) => (
                                <div key={index} className="flex justify-between text-sm text-gray-600">
                                  <span>{item.quantity}x {item.name}</span>
                                  <span>${item.subtotal}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {order.notes && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                              <h4 className="font-medium text-yellow-900 mb-1">📝 Notas del cliente:</h4>
                              <p className="text-yellow-800 text-sm">{order.notes}</p>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500">Entregado: {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : new Date(order.updatedAt).toLocaleString()}</p>
                            <Link to={`/driver/orders/${order._id}`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium">
                              📍 Ver Detalles
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Órdenes asignadas: tarjeta completa como antes
                return (
                  <div key={order._id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Pedido #{order._id.slice(-6)}</h3>
                        <p className="text-gray-600">Cliente: {order.userId?.name || order.userId?.email || 'N/A'}</p>
                        <p className="text-gray-600">Restaurante: {order.restaurantId?.name || 'N/A'}</p>
                        <p className="text-gray-600">Dirección: {order.deliveryAddress}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                        <p className="text-sm text-gray-500 mt-2">${order.total} total</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Items del pedido:</h4>
                      <div className="space-y-1">
                        {order.items?.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm text-gray-600">
                            <span>{item.quantity}x {item.name}</span>
                            <span>${item.subtotal}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.status === 'on_the_way' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                          <span className="mr-2">🚚</span> Ubicación en tiempo real:
                        </h4>
                        <p className="text-blue-800 font-medium">{getDriverLocation(order)}</p>
                        <div className="text-xs text-blue-600 mt-2">Última actualización: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Cargando...'}</div>
                      </div>
                    )}

                    {order.notes && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <h4 className="font-medium text-yellow-900 mb-1">📝 Notas del cliente:</h4>
                        <p className="text-yellow-800 text-sm">{order.notes}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">Actualizado: {new Date(order.updatedAt).toLocaleString()}</div>
                      <div className="flex space-x-2">
                        <Link to={`/driver/orders/${order._id}`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium">📍 Ver Detalles</Link>
                        {getNextActions(order).map((action, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              if (order.status === 'assigned' && action.status === 'heading_to_restaurant') {
                                const ok = window.confirm('¿Querés aceptar este pedido y empezar a ir al restaurante?');
                                if (!ok) return;
                              }
                              updateOrderStatus(order._id, action.status);
                            }}
                            disabled={updatingOrder === order._id}
                            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 text-sm disabled:opacity-50"
                          >
                            {updatingOrder === order._id ? 'Actualizando...' : action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Información adicional */}
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              💡 Información para conductores
            </h3>
            <ul className="text-blue-800 space-y-1 text-sm">
              <li>• Los pedidos aparecen automáticamente cuando son asignados por un administrador</li>
              <li>• Actualiza el estado del pedido conforme avances en la entrega</li>
              <li>• Marca como "Entregado" solo cuando el pedido llegue al cliente</li>
              <li>• Si hay problemas, contacta al administrador del sistema</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DriverOrders;