// Navegación condicional por rol: client (Home, Restaurantes, Carrito, Órdenes, Perfil); driver (Dashboard, Órdenes, Mapa, Estadísticas, Perfil, Toggle). Minimalista, mobile-first.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, MapPin, Package, User, BarChart3, LogOut, Menu, X } from 'lucide-react';
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
  }, [fetchPendingOrders, isDriver]);

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
          <Link to="/" className={`flex items-center gap-1.5 ${linkClass('/')}`}><Home className="w-4 h-4" /> Inicio</Link>
          <Link to="/restaurants" className={`flex items-center gap-1.5 ${linkClass('/restaurants')}`}><MapPin className="w-4 h-4" /> Restaurantes</Link>
        </>
      );
    }

    if (isDriver()) {
      return (
        <>
          <Link to="/driver/orders" className={`relative flex items-center gap-1.5 ${linkClass('/driver/orders')}`}><Package className="w-4 h-4" /> Órdenes <Badge count={pendingCount} /></Link>
          <Link to="/driver/map" className={`flex items-center gap-1.5 ${linkClass('/driver/map')}`}><MapPin className="w-4 h-4" /> Mapa</Link>
          <Link to="/driver/stats" className={`flex items-center gap-1.5 ${linkClass('/driver/stats')}`}><BarChart3 className="w-4 h-4" /> Estadísticas</Link>
          <Link to="/driver/profile" className={`flex items-center gap-1.5 ${linkClass('/driver/profile')}`}><User className="w-4 h-4" /> Perfil</Link>
          <AvailabilityToggle compact={false} />
          <GpsIndicator />
        </>
      );
    }

    if (isAdmin()) {
      return (
        <>
          <Link to="/profile" className={`flex items-center gap-1.5 ${linkClass('/profile')}`}><User className="w-4 h-4" /> Perfil</Link>
          <Link to="/admin/dashboard" className={`flex items-center gap-1.5 ${linkClass('/admin/dashboard')}`}>Dashboard</Link>
        </>
      );
    }

    // Cliente: Home, Restaurantes, Carrito (badge), Órdenes, Perfil
    return (
      <>
        <Link to="/" className={`flex items-center gap-1.5 ${linkClass('/')}`}><Home className="w-4 h-4" /> Inicio</Link>
        <Link to="/restaurants" className={`flex items-center gap-1.5 ${linkClass('/restaurants')}`}><MapPin className="w-4 h-4" /> Restaurantes</Link>
        <Link to="/cart" className={`relative flex items-center gap-1.5 ${linkClass('/cart')}`}><Package className="w-4 h-4" /> Carrito <Badge count={getTotalItemsCount()} /></Link>
        <Link to="/orders" className={`flex items-center gap-1.5 ${linkClass('/orders')}`}>Órdenes</Link>
        <Link to="/profile" className={`flex items-center gap-1.5 ${linkClass('/profile')}`}><User className="w-4 h-4" /> Perfil</Link>
      </>
    );
  };

  const renderMobileLinks = () => {
    if (!isAuthenticated()) {
      return (
        <>
          <Link to="/" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><Home className="w-4 h-4" /> Inicio</Link>
          <Link to="/restaurants" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><MapPin className="w-4 h-4" /> Restaurantes</Link>
          <div className="border-t border-gray-200 my-2" />
          <Link to="/login" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Iniciar Sesión</Link>
          <Link to="/register" className="block py-2 text-orange-600 font-semibold">Registrarse</Link>
        </>
      );
    }

    if (isDriver()) {
      return (
        <>
          <div className="flex items-center justify-between py-3 border-b border-gray-200 mb-2">
            <AvailabilityToggle compact={false} />
            <GpsIndicator />
          </div>
          <Link to="/driver/orders" className="flex items-center justify-between py-2 text-gray-700 hover:text-orange-600 font-medium">
            <span className="flex items-center gap-2"><Package className="w-4 h-4" /> Órdenes</span>
            {pendingCount > 0 && <span className="bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">{pendingCount}</span>}
          </Link>
          <Link to="/driver/map" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><MapPin className="w-4 h-4" /> Mapa</Link>
          <Link to="/driver/stats" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><BarChart3 className="w-4 h-4" /> Estadísticas</Link>
          <Link to="/driver/profile" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><User className="w-4 h-4" /> Perfil</Link>
          <div className="border-t border-gray-200 my-2" />
          <button onClick={handleLogout} className="flex items-center gap-2 w-full text-left py-2 text-red-600 hover:text-red-700 font-medium"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
        </>
      );
    }

    if (isAdmin()) {
      return (
        <>
          <Link to="/profile" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><User className="w-4 h-4" /> Perfil</Link>
          <Link to="/admin/dashboard" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Dashboard</Link>
          <div className="border-t border-gray-200 my-2" />
          <button onClick={handleLogout} className="flex items-center gap-2 w-full text-left py-2 text-red-600 hover:text-red-700 font-medium"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
        </>
      );
    }

    // Cliente
    return (
      <>
        <Link to="/" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><Home className="w-4 h-4" /> Inicio</Link>
        <Link to="/restaurants" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><MapPin className="w-4 h-4" /> Restaurantes</Link>
        <Link to="/orders" className="block py-2 text-gray-700 hover:text-orange-600 font-medium">Órdenes</Link>
        <Link to="/cart" className="flex items-center justify-between py-2 text-gray-700 hover:text-orange-600 font-medium">
          <span className="flex items-center gap-2"><Package className="w-4 h-4" /> Carrito</span>
          {getTotalItemsCount() > 0 && <span className="bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">{getTotalItemsCount()}</span>}
        </Link>
        <Link to="/profile" className="flex items-center gap-2 py-2 text-gray-700 hover:text-orange-600 font-medium"><User className="w-4 h-4" /> Perfil</Link>
        <div className="border-t border-gray-200 my-2" />
        <button onClick={handleLogout} className="flex items-center gap-2 w-full text-left py-2 text-red-600 hover:text-red-700 font-medium"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
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
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" /> Salir
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
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-orange-600 hover:bg-orange-50"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
