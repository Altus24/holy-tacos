// Tarjetas de conteo para el panel del conductor: asignados y completados
import React from 'react';

const OrderCounts = ({ counts, loading }) => {
  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-2/3 mx-auto mb-2" />
            <div className="h-6 bg-gray-100 rounded w-1/2 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  const { assigned = 0, completedToday = 0, completedTotal = 0 } = counts || {};

  return (
    <div className="grid md:grid-cols-3 gap-4 mb-6">
      {/* Pedidos asignados (activos: aún no completados por el cliente) */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg shadow p-6">
        <div className="text-center">
          <div className="text-3xl mb-2">📦</div>
          <div className="text-2xl font-bold text-blue-800">{assigned}</div>
          <div className="text-sm font-medium text-blue-700">Pedidos asignados</div>
          <div className="text-xs text-blue-600 mt-1">Activos (pendientes de completar)</div>
        </div>
      </div>

      {/* Completados hoy */}
      <div className="bg-green-50 border-2 border-green-200 rounded-lg shadow p-6">
        <div className="text-center">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-2xl font-bold text-green-800">{completedToday}</div>
          <div className="text-sm font-medium text-green-700">Completados hoy</div>
          <div className="text-xs text-green-600 mt-1">Entregas confirmadas por el cliente</div>
        </div>
      </div>

      {/* Total completados */}
      <div className="bg-green-100 border-2 border-green-300 rounded-lg shadow p-6">
        <div className="text-center">
          <div className="text-3xl mb-2">🏁</div>
          <div className="text-2xl font-bold text-green-900">{completedTotal}</div>
          <div className="text-sm font-medium text-green-800">Total completados</div>
          <div className="text-xs text-green-700 mt-1">Historial de entregas</div>
        </div>
      </div>
    </div>
  );
};

export default OrderCounts;
