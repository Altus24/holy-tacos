// Gestión de Drivers para el panel de administración de Holy Tacos
// Sistema de verificación granular: pending → approved/rejected
// Regla: un driver SOLO puede estar activo si verificationStatus === 'approved'
// "Todos" excluye rechazados; los rechazados solo aparecen en la pestaña Rechazados
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DriverCountsDashboard from './DriverCountsDashboard';
import DriverTableSkeleton from './DriverTableSkeleton';

const DriverManagement = ({ onStatsUpdate }) => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Pestaña activa: 'active' | 'pending' | 'approved' | 'rejected' | 'all'
  const [activeTab, setActiveTab] = useState('pending');
  // Conteos desde API (para tarjetas superiores y badges de pestañas)
  const [countsData, setCountsData] = useState({ total: 0, active: 0, availableNow: 0, pending: 0, approved: 0, rejected: 0 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estados de modales
  const [verifyModal, setVerifyModal] = useState({ show: false, driver: null, action: '' }); // action: 'approve' | 'reject' | 'revoke'
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, driverId: null, driverName: '' });
  const [detailsModal, setDetailsModal] = useState({ show: false, driver: null });
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Cargar conteos desde GET /api/admin/drivers/counts
  const loadCounts = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/drivers/counts');
      setCountsData(response.data?.data || countsData);
    } catch (error) {
      console.error('Error cargando conteos de drivers:', error);
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  // Mapeo pestaña → query param status. 'all' = solo approved+pending (excluye rejected)
  const getStatusForTab = (tab) => {
    if (tab === 'active' || tab === 'all') return tab === 'active' ? 'approved' : 'all';
    return tab; // pending | approved | rejected
  };

  // Cargar drivers según pestaña activa (cada pestaña hace su llamada con ?status=)
  const loadDrivers = useCallback(async (tab) => {
    const status = getStatusForTab(tab);
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/drivers?status=${status}`);
      let list = response.data.data || [];
      // En pestaña "Activos": filtrar solo los que tienen isActive !== false
      if (tab === 'active') {
        list = list.filter(d => d.driverProfile?.isActive !== false);
      }
      setDrivers(list);
    } catch (error) {
      console.error('Error cargando drivers:', error);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers(activeTab);
  }, [activeTab, loadDrivers]);

  // Refrescar lista y conteos después de cualquier acción
  const refreshAfterAction = useCallback(() => {
    setRefreshTrigger(t => t + 1);
    loadCounts();
    loadDrivers(activeTab);
    if (onStatsUpdate) onStatsUpdate();
  }, [activeTab, loadCounts, loadDrivers, onStatsUpdate]);

  // Obtener estado de verificación del driver (con fallback para datos legados)
  const getVerificationStatus = (driver) => {
    return driver.driverProfile?.verificationStatus || 'pending';
  };

  // Contadores para badges de pestañas (desde API /drivers/counts)
  const counts = {
    active: countsData.active,
    pending: countsData.pending,
    approved: countsData.approved,
    rejected: countsData.rejected,
    all: countsData.pending + countsData.approved // Todos = solo aprobados + pendientes (sin rechazados)
  };

  // Filtrar solo por búsqueda (la lista ya viene filtrada por pestaña desde la API)
  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = !searchTerm ||
      driver.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (driver.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // === Acciones de verificación ===

  // Abrir modal de verificación (aprobar, rechazar, revocar)
  const openVerifyModal = (driver, action) => {
    setVerifyModal({ show: true, driver, action });
    setVerifyNotes('');
    setMessage(null);
  };

  // Ejecutar acción de verificación
  const executeVerification = useCallback(async () => {
    const { driver, action } = verifyModal;
    if (!driver) return;

    // Validar notas obligatorias al rechazar
    if (action === 'reject' && (!verifyNotes || verifyNotes.trim() === '')) {
      setMessage({ type: 'error', text: 'Debés indicar el motivo del rechazo.' });
      return;
    }

    setVerifyLoading(true);
    setMessage(null);

    try {
      // Mapear acción a status del backend
      const statusMap = { approve: 'approved', reject: 'rejected', revoke: 'pending' };
      const newStatus = statusMap[action];

      const response = await axios.put(`/api/admin/drivers/${driver._id}/verify`, {
        status: newStatus,
        notes: verifyNotes
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        setVerifyModal({ show: false, driver: null, action: '' });
        setVerifyNotes('');
        refreshAfterAction();
        setTimeout(() => setMessage(null), 6000);
      }
    } catch (err) {
      console.error('Error en verificación:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Error al cambiar estado de verificación.'
      });
    } finally {
      setVerifyLoading(false);
    }
  }, [verifyModal, verifyNotes, refreshAfterAction]);

  // Toggle estado activo/inactivo (la disponibilidad online/offline la maneja el driver desde su app)
  const toggleDriverStatus = async (driver) => {
    try {
      const response = await axios.put(`/api/admin/drivers/${driver._id}/status`, {
        isActive: !(driver.driverProfile?.isActive !== false)
      });
      if (response.data.success) refreshAfterAction();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error al cambiar estado.' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Eliminar driver
  const executeDeleteDriver = async () => {
    try {
      await axios.delete(`/api/admin/drivers/${deleteConfirm.driverId}`);
      setMessage({ type: 'success', text: 'Driver eliminado exitosamente.' });
      setDeleteConfirm({ show: false, driverId: null, driverName: '' });
      refreshAfterAction();
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error eliminando driver:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Error al eliminar driver.' });
    }
  };

  // === Helpers de UI ===

  // Badge de verificación
  const VerificationBadge = ({ status }) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };
    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${styles[status] || styles.pending}`}>
        {status === 'pending' && <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5"></span>}
        {status === 'approved' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>}
        {status === 'rejected' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>}
        {labels[status] || 'Pendiente'}
      </span>
    );
  };

  // Botones de acción según estado de verificación
  const renderActions = (driver) => {
    const vStatus = getVerificationStatus(driver);
    const isApproved = vStatus === 'approved';
    const isActive = driver.driverProfile?.isActive !== false;

    return (
      <div className="flex flex-col gap-1.5">
        {/* PENDING: Ver | Aprobar | Rechazar */}
        {vStatus === 'pending' && (
          <div className="flex gap-1">
            <button
              onClick={() => openVerifyModal(driver, 'approve')}
              className="px-2.5 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-medium"
            >
              Aprobar
            </button>
            <button
              onClick={() => openVerifyModal(driver, 'reject')}
              className="px-2.5 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors font-medium"
            >
              Rechazar
            </button>
            <button
              onClick={() => setDetailsModal({ show: true, driver })}
              className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
              title="Ver detalles"
            >
              Ver
            </button>
          </div>
        )}

        {/* APPROVED: Ver | Estado en plataforma (Inactivar/Reactivar) | Eliminar si está inactivo. La disponibilidad (online/offline) la maneja el driver */}
        {vStatus === 'approved' && (
          <>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => toggleDriverStatus(driver)}
                className={`px-2 py-1 text-xs rounded text-white transition-colors ${
                  isActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'
                }`}
                title="Estado en plataforma: inactivar lo saca de la flota; reactivar lo vuelve a dar de alta"
              >
                {isActive ? 'Inactivar' : 'Reactivar'}
              </button>
              <button
                onClick={() => setDetailsModal({ show: true, driver })}
                className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
                title="Ver detalles"
              >
                Ver
              </button>
              {!isActive && (
                <button
                  onClick={() => setDeleteConfirm({ show: true, driverId: driver._id, driverName: driver.name || driver.email })}
                  className="px-2 py-1 bg-red-700 text-white text-xs rounded hover:bg-red-800 transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
          </>
        )}

        {/* REJECTED: Ver | Volver a Pending | Eliminar */}
        {vStatus === 'rejected' && (
          <div className="flex gap-1">
            <button
              onClick={() => openVerifyModal(driver, 'revoke')}
              className="px-2.5 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors font-medium"
            >
              Resetear
            </button>
            <button
              onClick={() => setDetailsModal({ show: true, driver })}
              className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
            >
              Ver
            </button>
            <button
              onClick={() => setDeleteConfirm({ show: true, driverId: driver._id, driverName: driver.name || driver.email })}
              className="px-2 py-1 bg-red-700 text-white text-xs rounded hover:bg-red-800 transition-colors"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    );
  };

  // Fecha de rechazo: verifiedAt o última entrada en verificationHistory con action rejected
  const getRejectionDate = (driver) => {
    const hist = driver.driverProfile?.verificationHistory || [];
    const rejectedEntry = [...hist].reverse().find(e => e.action === 'rejected');
    if (rejectedEntry?.date) return new Date(rejectedEntry.date);
    if (driver.driverProfile?.verifiedAt) return new Date(driver.driverProfile.verifiedAt);
    return null;
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Gestión de Drivers</h2>

      {/* Tarjetas de conteo: Total drivers, Activos, Disponibles ahora */}
      <DriverCountsDashboard refreshTrigger={refreshTrigger} />

      {/* Mensaje de feedback */}
      {message && (
        <div className={`border rounded-lg p-4 mb-6 flex items-start ${
          message.type === 'success' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          <div className="flex-1">
            <p className="text-sm font-medium">{message.text}</p>
          </div>
          <button onClick={() => setMessage(null)} className="ml-3 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tabs de verificación - badges con clases fijas para Tailwind */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" role="tablist" aria-label="Estados de drivers">
          {[
            { key: 'active', label: 'Activos', count: counts.active, badgeClass: 'bg-blue-100 text-blue-700' },
            { key: 'pending', label: 'Pendientes', count: counts.pending, badgeClass: 'bg-yellow-100 text-yellow-700' },
            { key: 'approved', label: 'Aprobados', count: counts.approved, badgeClass: 'bg-green-100 text-green-700' },
            { key: 'rejected', label: 'Rechazados', count: counts.rejected, badgeClass: 'bg-red-100 text-red-700' },
            { key: 'all', label: 'Todos', count: counts.all, badgeClass: 'bg-gray-100 text-gray-700' }
          ].map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                  tab.key === 'pending' && tab.count > 0 ? 'bg-red-500 text-white' : tab.badgeClass
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Tabla de drivers: skeleton al cargar; vacío o contenido según datos */}
      {loading ? (
        <DriverTableSkeleton rows={8} columns={activeTab === 'rejected' ? 6 : 7} />
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">
            {activeTab === 'pending' ? '✅' : activeTab === 'rejected' ? '📋' : activeTab === 'active' ? '🟢' : '🚗'}
          </div>
          <p>
            {activeTab === 'rejected'
              ? 'No hay drivers rechazados en este momento.'
              : `No se encontraron drivers ${activeTab === 'all' ? '' : activeTab === 'active' ? 'activos' : `con estado "${activeTab}"`}`}
          </p>
        </div>
      ) : activeTab === 'rejected' ? (
        /* Tabla dedicada Rechazados: Nombre, Email, Teléfono, Motivo rechazo, Fecha rechazo, Acciones */
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo de rechazo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha de rechazo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDrivers.map(driver => {
                const rejectionDate = getRejectionDate(driver);
                return (
                  <tr key={driver._id} className="hover:bg-red-50/30">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{driver.name || 'Sin nombre'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{driver.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{driver.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-red-700 max-w-xs truncate" title={driver.driverProfile?.verificationNotes || ''}>
                        {driver.driverProfile?.verificationNotes || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rejectionDate ? rejectionDate.toLocaleDateString('es-AR', { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td className="px-4 py-3">{renderActions(driver)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verificación</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disponible</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehículo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDrivers.map(driver => {
                const vStatus = getVerificationStatus(driver);
                return (
                  <tr key={driver._id} className={`hover:bg-gray-50 ${
                    vStatus === 'pending' ? 'bg-yellow-50/30' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="h-9 w-9 flex-shrink-0">
                          {driver.profilePicture ? (
                            <img className="h-9 w-9 rounded-full object-cover" src={driver.profilePicture} alt="" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-gray-600 font-medium text-sm">
                                {(driver.name || driver.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{driver.name || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-500">ID: {driver._id.slice(-6)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{driver.email}</div>
                      {driver.phone && <div className="text-xs text-gray-500">{driver.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <VerificationBadge status={vStatus} />
                      {vStatus === 'rejected' && driver.driverProfile?.verificationNotes && (
                        <p className="text-xs text-red-600 mt-1 truncate max-w-[150px]" title={driver.driverProfile.verificationNotes}>
                          {driver.driverProfile.verificationNotes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {vStatus === 'approved' ? (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          driver.driverProfile?.isAvailable
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {driver.driverProfile?.isAvailable ? 'Disponible' : 'No disponible'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{driver.driverProfile?.vehicle?.type || '—'}</div>
                      {driver.driverProfile?.vehicle?.plate && (
                        <div className="text-xs text-gray-500 font-mono">{driver.driverProfile.vehicle.plate}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{driver.driverProfile?.rating?.toFixed(1) || '—'} <span className="text-yellow-400">&#9733;</span></span>
                    </td>
                    <td className="px-4 py-3">{renderActions(driver)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === MODAL: Verificación (Aprobar / Rechazar / Revocar) === */}
      {verifyModal.show && verifyModal.driver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Encabezado */}
            <div className={`px-6 py-4 ${
              verifyModal.action === 'approve' ? 'bg-green-50' :
              verifyModal.action === 'reject' ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              <h3 className="text-lg font-bold text-gray-900">
                {verifyModal.action === 'approve' && 'Aprobar Driver'}
                {verifyModal.action === 'reject' && 'Rechazar Driver'}
                {verifyModal.action === 'revoke' && 'Revocar / Resetear Verificación'}
              </h3>
              <p className="text-sm text-gray-600">
                {verifyModal.driver.name || verifyModal.driver.email} — ID: {verifyModal.driver._id.slice(-6)}
              </p>
            </div>

            {/* Cuerpo */}
            <div className="px-6 py-5">
              {verifyModal.action === 'approve' && (
                <p className="text-sm text-gray-700 mb-4">
                  Al aprobar, este driver podrá activarse y recibir pedidos. Revisá que sus documentos y datos sean válidos.
                </p>
              )}
              {verifyModal.action === 'reject' && (
                <p className="text-sm text-red-700 mb-4">
                  Al rechazar, el driver será desactivado automáticamente. <strong>Debés indicar el motivo.</strong>
                </p>
              )}
              {verifyModal.action === 'revoke' && (
                <p className="text-sm text-yellow-700 mb-4">
                  Se restablecerá a estado "Pendiente". Si estaba activo, será desactivado automáticamente.
                </p>
              )}

              {/* Campo de notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {verifyModal.action === 'reject' ? 'Motivo del rechazo *' : 'Notas (opcional)'}
                </label>
                <textarea
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder={verifyModal.action === 'reject'
                    ? 'Indicá el motivo del rechazo...'
                    : 'Notas o comentarios adicionales...'}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  maxLength={500}
                />
              </div>

              {/* Error inline */}
              {message?.type === 'error' && (
                <p className="text-sm text-red-600 mt-2">{message.text}</p>
              )}
            </div>

            {/* Botones */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                onClick={() => { setVerifyModal({ show: false, driver: null, action: '' }); setMessage(null); }}
                disabled={verifyLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeVerification}
                disabled={verifyLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center ${
                  verifyModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  verifyModal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {verifyLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                )}
                {verifyModal.action === 'approve' && 'Aprobar Driver'}
                {verifyModal.action === 'reject' && 'Rechazar Driver'}
                {verifyModal.action === 'revoke' && 'Resetear a Pendiente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Confirmación de eliminación === */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Confirmar Eliminación</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de eliminar al driver <strong>"{deleteConfirm.driverName}"</strong>?
              <br />
              <span className="text-red-600 font-medium">Esta acción no se puede deshacer.</span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, driverId: null, driverName: '' })}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeDeleteDriver}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL: Detalles del Driver + Historial de verificación === */}
      {detailsModal.show && detailsModal.driver && (
        <DriverDetailsModal
          driver={detailsModal.driver}
          onClose={() => setDetailsModal({ show: false, driver: null })}
        />
      )}
    </div>
  );
};

// === Componente modal de detalles del driver con historial de verificación ===
const DriverDetailsModal = ({ driver, onClose }) => {
  const vStatus = driver.driverProfile?.verificationStatus || 'pending';
  const history = driver.driverProfile?.verificationHistory || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Encabezado */}
        <div className="px-6 py-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold">Detalles del Driver</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Info personal */}
            <div>
              <h4 className="text-lg font-medium mb-4">Información Personal</h4>
              <div className="flex items-center space-x-4 mb-4">
                {driver.profilePicture ? (
                  <img src={driver.profilePicture} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-gray-600 font-medium text-xl">
                      {(driver.name || driver.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h5 className="font-medium">{driver.name || 'Sin nombre'}</h5>
                  <p className="text-gray-600 text-sm">{driver.email}</p>
                  {driver.phone && <p className="text-gray-600 text-sm">{driver.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Verificación:</span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded font-medium ${
                    vStatus === 'approved' ? 'bg-green-100 text-green-800' :
                    vStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{vStatus === 'approved' ? 'Aprobado' : vStatus === 'rejected' ? 'Rechazado' : 'Pendiente'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Disponibilidad:</span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                    driver.driverProfile?.isAvailable ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                  }`}>{driver.driverProfile?.isAvailable ? 'Disponible' : 'No disponible'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Entregas:</span>
                  <span className="ml-2 font-medium">{driver.driverProfile?.totalDeliveries || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Rating:</span>
                  <span className="ml-2 font-medium">{driver.driverProfile?.rating?.toFixed(1) || '—'} &#9733;</span>
                </div>
              </div>

              {/* Notas de verificación */}
              {driver.driverProfile?.verificationNotes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs font-medium text-gray-500 uppercase">Notas de verificación:</span>
                  <p className="text-sm text-gray-700 mt-1">{driver.driverProfile.verificationNotes}</p>
                </div>
              )}
            </div>

            {/* Vehículo + Documentos */}
            <div>
              <h4 className="text-lg font-medium mb-4">Vehículo y Documentos</h4>
              {driver.driverProfile?.vehicle ? (
                <div className="space-y-2 text-sm mb-4">
                  <div><span className="text-gray-500">Tipo:</span> <span className="ml-1">{driver.driverProfile.vehicle.type}</span></div>
                  {driver.driverProfile.vehicle.brand && <div><span className="text-gray-500">Marca:</span> <span className="ml-1">{driver.driverProfile.vehicle.brand}</span></div>}
                  {driver.driverProfile.vehicle.model && <div><span className="text-gray-500">Modelo:</span> <span className="ml-1">{driver.driverProfile.vehicle.model}</span></div>}
                  {driver.driverProfile.vehicle.plate && <div><span className="text-gray-500">Patente:</span> <span className="ml-1 font-mono">{driver.driverProfile.vehicle.plate}</span></div>}
                  {driver.driverProfile.vehicle.color && <div><span className="text-gray-500">Color:</span> <span className="ml-1">{driver.driverProfile.vehicle.color}</span></div>}
                </div>
              ) : (
                <p className="text-gray-500 text-sm mb-4">Sin info de vehículo</p>
              )}

              {driver.driverProfile?.licenseNumber && (
                <div className="text-sm mb-2">
                  <span className="text-gray-500">Licencia:</span> <span className="ml-1 font-mono">{driver.driverProfile.licenseNumber}</span>
                  {driver.driverProfile.licenseExpiration && (
                    <span className="ml-2 text-gray-500">
                      (Vence: {new Date(driver.driverProfile.licenseExpiration).toLocaleDateString()})
                    </span>
                  )}
                </div>
              )}

              {/* Links a documentos */}
              <div className="space-y-1 text-sm">
                {driver.driverProfile?.documents?.licenseFront && (
                  <a href={driver.driverProfile.documents.licenseFront} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">Frente de licencia</a>
                )}
                {driver.driverProfile?.documents?.licenseBack && (
                  <a href={driver.driverProfile.documents.licenseBack} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">Reverso de licencia</a>
                )}
                {driver.driverProfile?.documents?.profileVerification && (
                  <a href={driver.driverProfile.documents.profileVerification} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">Verificación de perfil</a>
                )}
              </div>
            </div>
          </div>

          {/* === Historial de verificación === */}
          <div className="mt-8">
            <h4 className="text-lg font-medium mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Historial de Verificación
            </h4>

            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">Sin historial de verificación todavía.</p>
            ) : (
              <div className="relative pl-6 space-y-4">
                {/* Línea vertical del timeline */}
                <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-300"></div>

                {[...history].reverse().map((entry, index) => {
                  const actionLabels = {
                    approved: { label: 'Aprobado', color: 'bg-green-500' },
                    rejected: { label: 'Rechazado', color: 'bg-red-500' },
                    revoked: { label: 'Revocado', color: 'bg-yellow-500' },
                    submitted: { label: 'Restablecido a pendiente', color: 'bg-blue-500' }
                  };
                  const info = actionLabels[entry.action] || { label: entry.action, color: 'bg-gray-500' };

                  return (
                    <div key={index} className="relative flex items-start">
                      {/* Punto del timeline */}
                      <div className={`absolute -left-3.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${info.color}`}></div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{info.label}</span>
                          <span className="text-xs text-gray-500">
                            {entry.date ? new Date(entry.date).toLocaleString() : '—'}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-gray-600 mt-0.5">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverManagement;
