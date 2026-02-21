// Componente de navegación para Holy Tacos — con condicionales por rol
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axios from 'axios';

const Navbar = () => {
  const { user, logout, isAuthenticated, isAdmin, isDriver, refreshUser } = useAuth();
  const { getTotalItemsCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Estado del menú móvil
  const [mobileOpen, setMobileOpen] = useState(false);

  // Estado del toggle de disponibilidad del driver
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState('');

  // Badge de pedidos pendientes para driver
  const [pendingCount, setPendingCount] = useState(0);
  const pendingPoll = useRef(null);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Badge: conteo de pedidos asignados (activos) para el conductor. Usa /api/driver/orders/counts.
  const fetchPendingOrders = useCallback(async () => {
    if (!isDriver()) return;
    try {
      const res = await axios.get('/api/driver/orders/counts');
      if (res.data.success && res.data.data) {
        setPendingCount(res.data.data.assigned ?? 0);
      }
    } catch {
      // silencioso
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    if (isDriver()) {
      fetchPendingOrders();
      pendingPoll.current = setInterval(fetchPendingOrders, 30000);
    }
    return () => {
      if (pendingPoll.current) clearInterval(pendingPoll.current);
    };
  }, [fetchPendingOrders]);

  // Toggle de disponibilidad del driver
  const handleToggleAvailability = async () => {
    if (availLoading) return;
    setAvailError('');
    setAvailLoading(true);
    try {
      const newVal = !user?.driverProfile?.isAvailable;
      const res = await axios.put('/api/profile/driver/availability', { isAvailable: newVal });
      if (res.data.success) {
        await refreshUser();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al cambiar disponibilidad';
      setAvailError(msg);
      setTimeout(() => setAvailError(''), 4000);
    } finally {
      setAvailLoading(false);
    }
  };

  // Función para manejar el logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Helpers
  const driverAvailable = user?.driverProfile?.isAvailable;
  const gpsActive = user?.driverProfile?.shareLocation;

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `transition-colors font-medium ${isActive(path) ? 'text-orange-600' : 'text-gray-700 hover:text-orange-600'}`;

  // —— COMPONENTES INLINE ——

  // Badge numérico
  const Badge = ({ count }) => {
    if (!count || count <= 0) return null;
    return (
      <span className="absolute -top-2 -right-3 bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  // Toggle de disponibilidad (inline en navbar)
  const AvailabilityToggle = ({ compact }) => (
    <button
      onClick={handleToggleAvailability}
      disabled={availLoading}
      className={`flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold transition-all select-none
        ${driverAvailable
          ? 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-gray-400 bg-gray-100 text-gray-500 hover:bg-gray-200'}
        ${availLoading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
      `}
      title={driverAvailable ? 'Desactivar disponibilidad' : 'Activar disponibilidad'}
    >
      {/* Switch pill */}
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${driverAvailable ? 'bg-green-500' : 'bg-gray-400'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${driverAvailable ? 'translate-x-4' : 'translate-x-1'}`} />
      </span>
      {!compact && (
        <span className="hidden lg:inline">
          {availLoading ? 'Cambiando...' : driverAvailable ? 'Disponible' : 'No disponible'}
        </span>
      )}
    </button>
  );

  // Indicador GPS
  const GpsIndicator = () => (
    <div className="flex items-center gap-1 text-xs font-medium" title={gpsActive ? 'GPS activo' : 'GPS inactivo'}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${gpsActive ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
      <span className={gpsActive ? 'text-green-600' : 'text-red-400'}>GPS</span>
    </div>
  );

  // —— LINKS POR ROL ——

  const renderDesktopLinks = () => {
    if (!isAuthenticated()) {
      return (
        <>
          <Link to="/" className={linkClass('/')}>Inicio</Link>
          <Link to="/restaurants" className={linkClass('/restaurants')}>Restaurantes</Link>
        </>
      );
    }

    if (isDriver()) {
      return (
        <>
          <Link to="/driver/map" className={linkClass('/driver/map')}>
            Mapa
          </Link>
          {/* Link a entregas con badge */}
          <Link to="/driver/orders" className={`relative ${linkClass('/driver/orders')}`}>
            Mis Entregas
            <Badge count={pendingCount} />
          </Link>

          {/* Toggle de disponibilidad */}
          <AvailabilityToggle compact={false} />

          {/* GPS indicator */}
          <GpsIndicator />
        </>
      );
    }

    if (isAdmin()) {
      return (
        <>
          <Link to="/profile" className={linkClass('/profile')}>Perfil</Link>
          <Link to="/admin/dashboard" className={linkClass('/admin/dashboard')}>Dashboard</Link>
        </>
      );
    }

    // Cliente
    return (
      <>
        <Link to="/" className={linkClass('/')}>Inicio</Link>
        <Link to="/restaurants" className={linkClass('/restaurants')}>Restaurantes</Link>
        <Link to="/orders" className={linkClass('/orders')}>Mis Pedidos</Link>
        <Link to="/cart" className={`relative ${linkClass('/cart')}`}>
          Carrito
          {getTotalItemsCount() > 0 && (
            <span className="absolute -top-2 -right-3 bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {getTotalItemsCount()}
            </span>
          )}
        </Link>
      </>
    );
  };

  const renderMobileLinks = () => {
    if (!isAuthenticated()) {
      return (
        <>
          <Link to="/" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Inicio</Link>
          <Link to="/restaurants" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Restaurantes</Link>
          <div className="border-t border-gray-200 my-2" />
          <Link to="/login" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Iniciar Sesión</Link>
          <Link to="/register" className="block py-2 text-orange-600 hover:text-orange-700 font-semibold">Registrarse</Link>
        </>
      );
    }

    if (isDriver()) {
      return (
        <>
          {/* Toggle prominente arriba */}
          <div className="flex items-center justify-between py-3 px-1 border-b border-gray-200 mb-2">
            <AvailabilityToggle compact={false} />
            <GpsIndicator />
          </div>

          <Link to="/driver/map" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Mapa</Link>
          <Link to="/driver/orders" className="flex items-center justify-between py-2 text-gray-700 hover:text-orange-600 font-medium">
            <span>Mis Entregas</span>
            {pendingCount > 0 && (
              <span className="bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </Link>

          <Link to="/profile" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Mi Perfil</Link>

          <div className="border-t border-gray-200 my-2" />
          <button onClick={handleLogout} className="block w-full text-left py-2 text-red-600 hover:text-red-700 font-medium">
            Cerrar Sesión
          </button>
        </>
      );
    }

    if (isAdmin()) {
      return (
        <>
          <Link to="/profile" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Perfil</Link>
          <Link to="/admin/dashboard" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Dashboard</Link>
          <div className="border-t border-gray-200 my-2" />
          <button onClick={handleLogout} className="block w-full text-left py-2 text-red-600 hover:text-red-700 font-medium">
            Cerrar Sesión
          </button>
        </>
      );
    }

    // Cliente
    return (
      <>
        <Link to="/" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Inicio</Link>
        <Link to="/restaurants" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Restaurantes</Link>
        <Link to="/orders" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Mis Pedidos</Link>
        <Link to="/cart" className="flex items-center justify-between py-2 text-gray-700 hover:text-orange-600 font-medium">
          <span>Carrito</span>
          {getTotalItemsCount() > 0 && (
            <span className="bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {getTotalItemsCount()}
            </span>
          )}
        </Link>
        <Link to="/profile" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Perfil</Link>
        <div className="border-t border-gray-200 my-2" />
        <button onClick={handleLogout} className="block w-full text-left py-2 text-red-600 hover:text-red-700 font-medium">
          Cerrar Sesión
        </button>
      </>
    );
  };

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={isDriver() ? '/driver/map' : '/'} className="flex items-center shrink-0">
            <h1 className="text-2xl font-bold text-orange-600">Holy Tacos</h1>
          </Link>

          {/* Links desktop */}
          <div className="hidden md:flex items-center space-x-6">
            {renderDesktopLinks()}
          </div>

          {/* Right side — desktop */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated() ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 text-gray-700 hover:text-orange-600 transition-colors text-sm font-medium"
                >
                  {/* Avatar placeholder */}
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
                    {(user.name || user.email || '?')[0].toUpperCase()}
                  </span>
                  <span className="hidden lg:inline">{user.name || user.email?.split('@')[0]}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-orange-600 transition-colors font-medium">
                  Iniciar Sesión
                </Link>
                <Link to="/register" className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium">
                  Registrarse
                </Link>
              </>
            )}
          </div>

          {/* Hamburger button — mobile */}
          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label="Abrir menú"
          >
            {mobileOpen ? (
              // X icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error inline de disponibilidad (driver) */}
      {availError && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-red-700 text-sm text-center">
          {availError}
        </div>
      )}

      {/* Panel móvil */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg px-4 pb-4 pt-2">
          {renderMobileLinks()}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
