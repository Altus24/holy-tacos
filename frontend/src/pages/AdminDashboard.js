// Panel de administración completo para Holy Tacos
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import axios from 'axios';

// Importar componentes de gestión
import RestaurantManagement from '../components/admin/RestaurantManagement';
import DriverManagement from '../components/admin/DriverManagement';
import OrderManagement from '../components/admin/OrderManagement';

// Vista inicial del administrador: siempre dashboard (no restaurantes ni otras pestañas)
const INITIAL_ADMIN_TAB = 'dashboard';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(INITIAL_ADMIN_TAB); // 'dashboard' | 'restaurants' | 'drivers' | 'orders'
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    totalUsers: 0,
    totalOrders: 0,
    activeOrders: 0,
    pendingOrders: 0,
    activeDrivers: 0,
    pendingVerificationDrivers: 0
  });
  const [loading, setLoading] = useState(true);

  // Cargar estadísticas iniciales y refrescar periódicamente (para que las burbujas se actualicen)
  useEffect(() => {
    loadDashboardStats();
    const interval = setInterval(loadDashboardStats, 60000); // cada 60 segundos
    return () => clearInterval(interval);
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/dashboard');
      const data = response.data?.data || {};
      setStats({
        totalRestaurants: data.totalRestaurants ?? 0,
        totalUsers: data.totalUsers ?? 0,
        totalOrders: data.totalOrders ?? 0,
        activeOrders: data.activeOrders ?? 0,
        pendingOrders: data.pendingOrders ?? 0,
        activeDrivers: data.activeDrivers ?? 0,
        pendingVerificationDrivers: data.pendingVerificationDrivers ?? 0
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊', badge: null },
    { id: 'restaurants', label: '🏪 Restaurantes', icon: '🏪', badge: null },
    { id: 'drivers', label: '🚗 Drivers', icon: '🚗', badge: stats.pendingVerificationDrivers > 0 ? stats.pendingVerificationDrivers : null },
    { id: 'orders', label: '📦 Órdenes', icon: '📦', badge: stats.pendingOrders > 0 ? stats.pendingOrders : null }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview stats={stats} onTabChange={setActiveTab} />;
      case 'restaurants':
        return <RestaurantManagement onStatsUpdate={loadDashboardStats} />;
      case 'drivers':
        return <DriverManagement onStatsUpdate={loadDashboardStats} />;
      case 'orders':
        return <OrderManagement onStatsUpdate={loadDashboardStats} />;
      default:
        return <DashboardOverview stats={stats} onTabChange={setActiveTab} />;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Panel de Administración
            </h1>
            <p className="text-gray-600 mt-2">
              Bienvenido, {user?.email}. Gestiona tu plataforma Holy Tacos.
            </p>
          </div>

          {/* Navegación por pestañas */}
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{tab.icon} {tab.label}</span>
                    {tab.badge != null && tab.badge > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white">
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Contenido de la pestaña activa */}
          <div className="bg-white rounded-lg shadow">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Componente para la vista general del dashboard
const DashboardOverview = ({ stats, onTabChange }) => (
  <div className="p-6">
    {/* Estadísticas principales */}
    <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
      <div className="bg-blue-50 p-4 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors"
           onClick={() => onTabChange('restaurants')}>
        <div className="text-2xl mb-2">🏪</div>
        <div className="text-2xl font-bold text-blue-600">{stats.totalRestaurants}</div>
        <div className="text-sm text-blue-600">Restaurantes</div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg text-center cursor-pointer hover:bg-green-100 transition-colors"
           onClick={() => onTabChange('drivers')}>
        <div className="text-2xl mb-2">🚗</div>
        <div className="text-2xl font-bold text-green-600">{stats.activeDrivers}</div>
        <div className="text-sm text-green-600">Drivers Activos</div>
      </div>

      <div className="bg-purple-50 p-4 rounded-lg text-center cursor-pointer hover:bg-purple-100 transition-colors"
           onClick={() => onTabChange('drivers')}>
        <div className="text-2xl mb-2">⏳</div>
        <div className="text-2xl font-bold text-purple-600">{stats.pendingVerificationDrivers}</div>
        <div className="text-sm text-purple-600">Drivers pendientes de verificación</div>
      </div>

      <div className="bg-red-50 p-4 rounded-lg text-center cursor-pointer hover:bg-red-100 transition-colors"
           onClick={() => onTabChange('orders')}>
        <div className="text-2xl mb-2">🔔</div>
        <div className="text-2xl font-bold text-red-600">{stats.pendingOrders}</div>
        <div className="text-sm text-red-600">Órdenes Pendientes</div>
      </div>

      <div className="bg-indigo-50 p-4 rounded-lg text-center cursor-pointer hover:bg-indigo-100 transition-colors"
           onClick={() => onTabChange('orders')}>
        <div className="text-2xl mb-2">🚚</div>
        <div className="text-2xl font-bold text-indigo-600">{stats.activeOrders}</div>
        <div className="text-sm text-indigo-600">Órdenes Activas</div>
      </div>

      <div className="bg-orange-50 p-4 rounded-lg text-center cursor-pointer hover:bg-orange-100 transition-colors"
           onClick={() => onTabChange('orders')}>
        <div className="text-2xl mb-2">📦</div>
        <div className="text-2xl font-bold text-orange-600">{stats.totalOrders}</div>
        <div className="text-sm text-orange-600">Total Órdenes</div>
      </div>
    </div>

    {/* Acciones rápidas */}
    <div className="grid md:grid-cols-3 gap-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">🏪 Gestión de Restaurantes</h3>
        <p className="text-gray-600 mb-4">
          Crear, editar y gestionar los restaurantes de tu plataforma.
        </p>
        <button
          onClick={() => onTabChange('restaurants')}
          className="w-full bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 transition-colors"
        >
          Gestionar Restaurantes
        </button>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">🚗 Gestión de Drivers</h3>
        <p className="text-gray-600 mb-4">
          Verificar, gestionar y monitorear a tus conductores.
        </p>
        <button
          onClick={() => onTabChange('drivers')}
          className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
        >
          Gestionar Drivers
        </button>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">📦 Gestión de Órdenes</h3>
        <p className="text-gray-600 mb-4">
          Asignar drivers y monitorear el estado de los pedidos.
        </p>
        <button
          onClick={() => onTabChange('orders')}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
        >
          Gestionar Órdenes
        </button>
      </div>
    </div>
  </div>
);

export default AdminDashboard;