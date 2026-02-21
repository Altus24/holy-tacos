import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useSocket } from '../../context/SocketContext';
import CancelOrderAdminModal from './CancelOrderAdminModal';

const OrderManagement = ({ onStatsUpdate }) => {
  const {
    onOrderStatusUpdateAdmin,
    onNewOrderCreated,
    onDriverHeadingToRestaurant,
    onOrderOnTheWay,
    onOrderCompleted
  } = useSocket();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'active', 'completed'
  const [assigningDriver, setAssigningDriver] = useState(null);
  const [settingReady, setSettingReady] = useState(null);
  const [expandedHistoryOrderId, setExpandedHistoryOrderId] = useState(null);

  // Estados para cancelación de pedidos por admin
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Estado para reasignación de driver
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignOrder, setReassignOrder] = useState(null);
  const [reassignDriverId, setReassignDriverId] = useState('');
  const [reassignOnlyAvailable, setReassignOnlyAvailable] = useState(true);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [expandedCompletedOrderId, setExpandedCompletedOrderId] = useState(null); // dropdown completadas
  // Conductor elegido en el dropdown por pedido (solo se asigna al confirmar con el botón)
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState({}); // { orderId: driverId }

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  // Notificaciones en tiempo real para admin: refetch y toasts
  useEffect(() => {
    const un1 = onNewOrderCreated?.((p) => {
      toast.success(p?.message || 'Nueva orden pendiente de asignación');
      loadData();
      if (onStatsUpdate) onStatsUpdate();
    });
    const un2 = onDriverHeadingToRestaurant?.((p) => {
      toast.success(p?.message || 'El driver está en camino al restaurante');
      loadData();
      if (onStatsUpdate) onStatsUpdate();
    });
    const un3 = onOrderStatusUpdateAdmin?.((p) => {
      const shortId = p?.orderId ? String(p.orderId).slice(-6) : '???';
      toast.success(`Driver en camino para pedido #${shortId}`);
      loadData();
      if (onStatsUpdate) onStatsUpdate();
    });
    const un4 = onOrderOnTheWay?.((p) => {
      toast.success(p?.message || 'El pedido está en camino al domicilio');
      loadData();
      if (onStatsUpdate) onStatsUpdate();
    });
    const un5 = onOrderCompleted?.((p) => {
      toast.success(p?.message || 'El cliente confirmó la entrega');
      loadData();
      if (onStatsUpdate) onStatsUpdate();
    });
    return () => {
      if (un1) un1();
      if (un2) un2();
      if (un3) un3();
      if (un4) un4();
      if (un5) un5();
    };
  }, [onNewOrderCreated, onDriverHeadingToRestaurant, onOrderStatusUpdateAdmin, onOrderOnTheWay, onOrderCompleted, onStatsUpdate]);

  const loadData = async (tab = activeTab) => {
    try {
      setLoading(true);
      // Órdenes pagadas: GET /api/orders (admin ya filtra por paymentStatus: 'paid')
      const ordersUrl = '/api/orders';
      const [ordersRes, usersRes] = await Promise.all([
        axios.get(ordersUrl),
        axios.get('/api/users')
      ]);
      setOrders(ordersRes.data.data || []);
      setDrivers(usersRes.data.data?.filter(user => user.role === 'driver') || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignDriver = async (orderId, driverId) => {
    try {
      setAssigningDriver(orderId);
      await axios.put(`/api/admin/orders/${orderId}/assign-driver`, { driverId });
      setSelectedDriverForOrder(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      loadData();
      if (onStatsUpdate) onStatsUpdate();
      toast.success('Driver asignado correctamente');
    } catch (error) {
      console.error('Error asignando driver:', error);
      toast.error('Error al asignar driver: ' + (error.response?.data?.message || 'Error desconocido'));
    } finally {
      setAssigningDriver(null);
    }
  };

  const handleConfirmAssignDriver = (order, driverId) => {
    const driver = drivers.find(d => d._id === driverId);
    const driverName = driver?.name || driver?.email || 'el conductor';
    const shortId = order._id.slice(-6);
    const message = `¿Asignar a ${driverName} al pedido #${shortId}?`;
    if (!window.confirm(message)) return;
    assignDriver(order._id, driverId);
  };

  // Reasignar driver utilizando la misma ruta, pero con flag `reassign: true`
  const reassignDriver = async () => {
    if (!reassignOrder || !reassignDriverId) return;
    try {
      setReassignLoading(true);
      await axios.put(`/api/admin/orders/${reassignOrder._id}/assign-driver`, {
        driverId: reassignDriverId,
        reassign: true
      });
      toast.success('Driver reasignado correctamente');
      setReassignModalOpen(false);
      setReassignOrder(null);
      setReassignDriverId('');
      loadData();
      if (onStatsUpdate) onStatsUpdate();
    } catch (error) {
      console.error('Error reasignando driver:', error);
      toast.error(error.response?.data?.message || 'Error al reasignar driver');
    } finally {
      setReassignLoading(false);
    }
  };

  const setReadyForPickup = async (orderId) => {
    try {
      setSettingReady(orderId);
      await axios.put(`/api/admin/orders/${orderId}/ready`);
      loadData();
      if (onStatsUpdate) onStatsUpdate();
      toast.success('Pedido marcado como listo para recoger');
    } catch (error) {
      console.error('Error al marcar listo:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar');
    } finally {
      setSettingReady(null);
    }
  };

  const getPendingOrders = () => orders.filter(order =>
    order.status === 'pending' && !order.driverId
  );

  const getActiveOrders = () => orders.filter(order =>
    ['assigned', 'heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way'].includes(order.status)
  );

  const getCompletedOrders = () => orders.filter(order =>
    ['delivered', 'completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_client_with_penalty',
     'cancelled_by_admin', 'cancelled_by_admin_with_penalty', 'cancelled_by_driver'].includes(order.status)
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'heading_to_restaurant': return 'bg-indigo-100 text-indigo-800';
      case 'ready_for_pickup': return 'bg-purple-100 text-purple-800';
      case 'at_restaurant': return 'bg-amber-100 text-amber-800';
      case 'on_the_way': return 'bg-orange-100 text-orange-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-green-200 text-green-900';
      case 'cancelled_by_driver': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'cancelled_by_client': return 'bg-red-100 text-red-700';
      case 'cancelled_by_client_with_penalty': return 'bg-red-200 text-red-900';
      case 'cancelled_by_admin': return 'bg-red-100 text-red-700';
      case 'cancelled_by_admin_with_penalty': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'assigned': return 'Asignado';
      case 'heading_to_restaurant': return 'Driver yendo al restaurante';
      case 'ready_for_pickup': return 'Listo para recoger';
      case 'at_restaurant': return 'En el restaurante';
      case 'on_the_way': return 'En camino a entregar';
      case 'delivered': return 'Entregado';
      case 'completed': return 'Completado';
      case 'cancelled_by_driver': return 'Cancelado por conductor';
      case 'cancelled': return 'Cancelado';
      case 'cancelled_by_client': return 'Cancelado por cliente';
      case 'cancelled_by_client_with_penalty': return 'Cancelado por cliente (penalidad)';
      case 'cancelled_by_admin': return 'Cancelado por admin';
      case 'cancelled_by_admin_with_penalty': return 'Cancelado por admin (penalidad)';
      default: return status;
    }
  };

  // Formatear una entrada del historial de status para mostrar en la UI
  const formatHistoryEntry = (entry) => {
    const roleLabel = entry.role === 'admin' ? 'Admin' : entry.role === 'driver' ? 'Conductor' : entry.role || 'Sistema';
    const dateStr = entry.changedAt
      ? format(new Date(entry.changedAt), 'dd/MM/yyyy HH:mm')
      : '—';
    return `${getStatusText(entry.status)} por ${roleLabel} a las ${dateStr}`;
  };

  // Ordenar historial por fecha (más antiguo primero)
  const getSortedStatusHistory = (order) => {
    const history = order?.statusHistory || [];
    return [...history].sort((a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0));
  };

  // Determinar si un pedido se puede cancelar desde admin
  const isCancellableByAdmin = (order) => {
    const estadosFinales = [
      'delivered', 'completed', 'cancelled',
      'cancelled_by_client', 'cancelled_by_client_with_penalty',
      'cancelled_by_admin', 'cancelled_by_admin_with_penalty', 'cancelled_by_driver'
    ];
    return !estadosFinales.includes(order.status);
  };

  // Determinar si un pedido se puede reasignar a otro driver
  const isReassignableByAdmin = (order) => {
    if (!order.driverId) return false;
    const estadosBloqueados = [
      'on_the_way', 'delivered', 'completed',
      'cancelled', 'cancelled_by_client', 'cancelled_by_client_with_penalty',
      'cancelled_by_admin', 'cancelled_by_admin_with_penalty', 'cancelled_by_driver'
    ];
    return !estadosBloqueados.includes(order.status);
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

  // Confirmar cancelación del pedido por admin
  const handleConfirmCancel = useCallback(async (reason) => {
    if (!selectedOrder) return;

    setCancelLoading(true);
    setCancelMessage(null);

    try {
      const response = await axios.put(`/api/admin/orders/${selectedOrder._id}/cancel`, {
        reason
      });

      if (response.data.success) {
        // Actualizar el pedido en la lista local sin recargar todo
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

        // Actualizar estadísticas del dashboard
        if (onStatsUpdate) onStatsUpdate();

        // Limpiar mensaje después de 8 segundos
        setTimeout(() => setCancelMessage(null), 8000);
      }
    } catch (err) {
      console.error('Error al cancelar pedido desde admin:', err);
      setCancelMessage({
        type: 'error',
        text: err.response?.data?.message || 'Error al cancelar el pedido. Inténtalo nuevamente.'
      });
    } finally {
      setCancelLoading(false);
    }
  }, [selectedOrder, onStatsUpdate]);

  if (loading) {
    return <div className="p-6 text-center">Cargando órdenes...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Órdenes</h2>
      {lastUpdate && (
        <p className="text-sm text-gray-500 mb-6">
          Última actualización: {lastUpdate.toLocaleTimeString()}
        </p>
      )}
      {!lastUpdate && <div className="mb-6" />}

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

      {/* Navegación por pestañas */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔔 Pendientes ({getPendingOrders().length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🚚 Activas ({getActiveOrders().length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'completed'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ✅ Completadas ({getCompletedOrders().length})
            </button>
          </nav>
        </div>
      </div>

      {/* Contenido de las pestañas */}
      {activeTab === 'pending' && (
        <div>
          <h3 className="text-xl font-semibold text-orange-600 mb-4">
            Órdenes Pendientes de Asignación
          </h3>

          {getPendingOrders().length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <p>No hay órdenes pendientes de asignación</p>
            </div>
          ) : (
            <div className="space-y-4">
              {getPendingOrders().map(order => (
                <div key={order._id} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold">
                        Pedido #{order._id.slice(-6)}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Cliente: {order.userId?.email || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Restaurante: {order.restaurantId?.name || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Dirección: {order.deliveryAddress}
                      </p>
                      <p className="text-sm text-gray-500">
                        Creado: {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800 mb-2">
                        Pendiente
                      </span>
                      <p className="text-sm font-medium">${order.total}</p>
                    </div>
                  </div>

                  {/* Items del pedido */}
                  <div className="mb-3">
                    <p className="text-sm text-gray-700 font-medium mb-1">Items:</p>
                    <div className="flex flex-wrap gap-2">
                      {order.items?.map((item, index) => (
                        <span key={index} className="px-2 py-1 bg-white rounded text-sm">
                          {item.quantity}x {item.name} - ${item.subtotal}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Asignar conductor: selección + botón para confirmar */}
                  <div className="flex items-center flex-wrap gap-2">
                    <label className="text-sm font-medium text-gray-700">
                      Asignar Conductor:
                    </label>
                    <select
                      className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      value={selectedDriverForOrder[order._id] || ''}
                      onChange={(e) => {
                        const value = e.target.value || null;
                        setSelectedDriverForOrder(prev => ({ ...prev, [order._id]: value }));
                      }}
                      disabled={assigningDriver === order._id}
                    >
                      <option value="">Seleccionar conductor...</option>
                      {drivers
                        .filter(d => d.driverProfile?.verificationStatus === 'approved' && d.driverProfile?.isAvailable)
                        .map(driver => (
                          <option key={driver._id} value={driver._id}>
                            {driver.name || driver.email} - {driver.driverProfile?.vehicle?.type || 'Sin vehículo'}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleConfirmAssignDriver(order, selectedDriverForOrder[order._id])}
                      disabled={!selectedDriverForOrder[order._id] || assigningDriver === order._id}
                      className="px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {assigningDriver === order._id ? 'Asignando...' : 'Asignar'}
                    </button>

                    {assigningDriver === order._id && (
                      <div className="flex items-center text-blue-600 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Asignando...
                      </div>
                    )}

                    {/* Botón cancelar pedido (admin) */}
                    <button
                      onClick={() => handleOpenCancelModal(order)}
                      className="ml-auto flex items-center px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                      title="Cancelar pedido"
                    >
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancelar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'active' && (
        <div>
          <h3 className="text-xl font-semibold text-green-600 mb-4">
            Órdenes Activas
          </h3>

          {getActiveOrders().length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📦</div>
              <p>No hay órdenes activas</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {getActiveOrders().map(order => (
                <div key={order._id} className="border rounded-lg p-4 bg-green-50 border-green-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">
                        Pedido #{order._id.slice(-6)}
                      </h4>
                      <p className="text-xs text-gray-600">
                        Cliente: {order.userId?.email || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600">
                        Restaurante: {order.restaurantId?.name || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-600">
                        Driver: {order.driverId?.name || order.driverId?.email || 'No asignado'}
                      </p>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 mb-2">
                    Dirección: {order.deliveryAddress}
                  </p>

                  <div className="text-xs text-gray-600 mb-2">
                    Items: {order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                  </div>

                  <p className="text-xs font-medium text-gray-800 mb-2">
                    Total: ${order.total}
                  </p>

                  {/* Acciones admin: marcar listo, cancelar y reasignar */}
                  <div className="flex flex-wrap gap-2">
                    {(order.status === 'assigned' || order.status === 'heading_to_restaurant') && (
                      <button
                        onClick={() => setReadyForPickup(order._id)}
                        disabled={settingReady === order._id}
                        className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        {settingReady === order._id ? 'Actualizando...' : 'Marcar como listo'}
                      </button>
                    )}

                    {/* Botón reasignar driver (solo si ya tiene driver y el estado lo permite) */}
                    {isReassignableByAdmin(order) && (
                      <button
                        onClick={() => {
                          setReassignOrder(order);
                          setReassignDriverId(order.driverId?._id || '');
                          setReassignOnlyAvailable(true);
                          setReassignModalOpen(true);
                        }}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex items-center"
                        title="Reasignar driver"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19l14-14" />
                        </svg>
                        Reasignar
                      </button>
                    )}

                    {/* Botón cancelar pedido (admin) */}
                    {isCancellableByAdmin(order) && (
                      <button
                        onClick={() => handleOpenCancelModal(order)}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors flex items-center"
                        title="Cancelar pedido"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancelar
                      </button>
                    )}
                  </div>

                  {/* Historial de status (expandible) */}
                  {getSortedStatusHistory(order).length > 0 && (
                    <div className="mt-3 border-t border-green-200 pt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryOrderId(expandedHistoryOrderId === order._id ? null : order._id)}
                        className="text-xs font-medium text-green-700 hover:text-green-800 flex items-center gap-1"
                      >
                        {expandedHistoryOrderId === order._id ? '▼' : '▶'} Historial de status
                      </button>
                      {expandedHistoryOrderId === order._id && (
                        <ul className="mt-2 space-y-1 text-xs text-gray-600 list-disc list-inside">
                          {getSortedStatusHistory(order).map((entry, idx) => (
                            <li key={idx}>{formatHistoryEntry(entry)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div>
          <h3 className="text-xl font-semibold text-blue-600 mb-4">
            Órdenes Completadas
          </h3>

          {getCompletedOrders().length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p>No hay órdenes completadas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {getCompletedOrders().map(order => {
                const isExpanded = expandedCompletedOrderId === order._id;
                const clientName = order.userId?.name || order.userId?.email || 'Cliente';
                return (
                  <div key={order._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedCompletedOrderId(isExpanded ? null : order._id)}
                      className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{clientName}</p>
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
                      <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm mt-3">
                          <div>
                            <span className="text-gray-500">Pedido</span>
                            <p className="font-medium">#{order._id.slice(-6)}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Cliente</span>
                            <p className="font-medium">{order.userId?.name || order.userId?.email || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Driver</span>
                            <p className="font-medium">{order.driverId?.name || order.driverId?.email || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Estado / Total</span>
                            <p className="font-medium">
                              <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(order.status)}`}>
                                {getStatusText(order.status)}
                              </span>
                              {' '} ${order.total}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Entregado</span>
                            <p className="font-medium">
                              {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '—'}
                            </p>
                          </div>
                        </div>
                        {order.items?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-500 uppercase mb-1">Items</p>
                            <div className="flex flex-wrap gap-2">
                              {order.items.map((item, idx) => (
                                <span key={idx} className="text-sm text-gray-700">
                                  {item.quantity}x {item.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Modal de cancelación de pedido (admin) */}
      <CancelOrderAdminModal
        isOpen={cancelModalOpen}
        onClose={handleCloseCancelModal}
        onConfirm={handleConfirmCancel}
        order={selectedOrder}
        isLoading={cancelLoading}
      />

      {/* Modal de reasignación de driver */}
      {reassignModalOpen && reassignOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
              <h3 className="text-lg font-bold text-gray-900">
                Reasignar driver para pedido #{reassignOrder._id.slice(-6)}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                Estado actual: <span className="font-medium">{getStatusText(reassignOrder.status)}</span>
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-700">
                Estás reasignando este pedido de{' '}
                <span className="font-semibold">
                  {reassignOrder.driverId?.name || reassignOrder.driverId?.email || 'driver anterior'}
                </span>{' '}
                a otro conductor. Elegí el nuevo driver de la lista.
              </p>

              {/* Filtro solo disponibles */}
              <label className="flex items-center text-sm text-gray-700 gap-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  checked={reassignOnlyAvailable}
                  onChange={(e) => setReassignOnlyAvailable(e.target.checked)}
                />
                Solo mostrar drivers disponibles ahora
              </label>

              {/* Selector de drivers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nuevo driver
                </label>
                <select
                  value={reassignDriverId}
                  onChange={(e) => setReassignDriverId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Seleccionar driver...</option>
                  {drivers
                    .filter(d => d.driverProfile?.verificationStatus === 'approved')
                    .filter(d => !reassignOnlyAvailable || d.driverProfile?.isAvailable)
                    .map(driver => (
                      <option key={driver._id} value={driver._id}>
                        {(driver.name || driver.email) || 'Sin nombre'}
                        {driver.driverProfile?.isAvailable ? ' — Disponible' : ' — No disponible'}
                      </option>
                    ))}
                </select>
              </div>

              {reassignDriverId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  Estás reasignando el pedido de{' '}
                  <span className="font-semibold">
                    {reassignOrder.driverId?.name || reassignOrder.driverId?.email || 'driver anterior'}
                  </span>{' '}
                  a{' '}
                  <span className="font-semibold">
                    {drivers.find(d => d._id === reassignDriverId)?.name ||
                     drivers.find(d => d._id === reassignDriverId)?.email ||
                     'nuevo driver'}
                  </span>.
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setReassignModalOpen(false); setReassignOrder(null); setReassignDriverId(''); }}
                disabled={reassignLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={reassignDriver}
                disabled={reassignLoading || !reassignDriverId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center"
              >
                {reassignLoading && (
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                )}
                Reasignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;