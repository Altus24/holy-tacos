// Tarjetas de conteo para la gestión de drivers (Total, Activos, Disponibles ahora)
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DriverCountsDashboard = ({ refreshTrigger }) => {
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    availableNow: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [loading, setLoading] = useState(true);

  const loadCounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/drivers/counts');
      setCounts(response.data?.data || counts);
    } catch (error) {
      console.error('Error cargando conteos de drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCounts();
  }, []);

  // Actualizar cuando el padre indica refresh (ej. después de aprobar/rechazar/resetear)
  useEffect(() => {
    if (refreshTrigger != null && refreshTrigger > 0) loadCounts();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 text-center animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2" />
          <div className="h-4 bg-gray-200 rounded w-24 mx-auto" />
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2" />
          <div className="h-4 bg-gray-200 rounded w-24 mx-auto" />
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2" />
          <div className="h-4 bg-gray-200 rounded w-24 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* Total drivers (pending + approved + rejected) */}
      <div className="bg-white rounded-lg shadow p-4 text-center border border-gray-100">
        <div className="text-2xl font-bold text-gray-800">{counts.total}</div>
        <div className="text-sm text-gray-600 mt-1">Total drivers</div>
      </div>
      {/* Activos: aprobados y con isActive !== false */}
      <div className="bg-white rounded-lg shadow p-4 text-center border border-green-100">
        <div className="text-2xl font-bold text-green-700">{counts.active}</div>
        <div className="text-sm text-gray-600 mt-1">Activos</div>
      </div>
      {/* Disponibles ahora: aprobados con isAvailable = true */}
      <div className="bg-white rounded-lg shadow p-4 text-center border border-blue-100">
        <div className="text-2xl font-bold text-blue-700">{counts.availableNow}</div>
        <div className="text-sm text-gray-600 mt-1">Disponibles ahora</div>
      </div>
    </div>
  );
};

export default DriverCountsDashboard;
