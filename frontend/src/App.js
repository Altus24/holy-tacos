// Importación de React y componentes necesarios
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Restaurants from './pages/Restaurants';
import RestaurantDetail from './pages/RestaurantDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderTracking from './pages/OrderTracking';
import RateOrder from './pages/RateOrder';
import OrderSuccess from './pages/OrderSuccess';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import DriverOrders from './pages/DriverOrders';
import DriverOrderDetail from './pages/DriverOrderDetail';
import DriverDashboard from './pages/DriverDashboard';

// Para la ruta "/": conductores van al mapa; el resto ve Home (restaurantes)
const HomeOrDriverRedirect = () => {
  const { isAuthenticated, isDriver, loading } = useAuth();
  if (!loading && isAuthenticated() && isDriver()) {
    return <Navigate to="/driver/map" replace />;
  }
  return <Home />;
};

// Componente para rutas protegidas
const ProtectedRoute = ({ children, requireRole }) => {
  const { isAuthenticated, hasRole, refreshUser } = useAuth();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthValid, setIsAuthValid] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        setIsAuthValid(true);
        setCheckingAuth(false);
        return;
      }

      // Intentar refrescar el usuario si no está autenticado
      const refreshed = await refreshUser();
      setIsAuthValid(refreshed);
      setCheckingAuth(false);
    };

    checkAuth();
  }, [isAuthenticated, refreshUser]);

  if (checkingAuth) {
    // Mostrar loading mientras verifica la autenticación
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthValid) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && !hasRole(requireRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Componente principal de la aplicación
function App() {
  return (
    // Configuración del enrutador de React
    <Router>
      <div className="App">
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        {/* Definición de rutas de la aplicación */}
        <Routes>
          {/* Ruta principal: conductores → mapa; clientes/no logueados → Home (restaurantes) */}
          <Route path="/" element={<HomeOrDriverRedirect />} />

          {/* Rutas de autenticación */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rutas públicas */}
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/restaurant/:id" element={<RestaurantDetail />} />

          {/* Rutas protegidas para usuarios autenticados */}
          <Route path="/cart" element={
            <ProtectedRoute>
              <Cart />
            </ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          } />
          <Route path="/orders/:orderId" element={
            <ProtectedRoute>
              <OrderTracking />
            </ProtectedRoute>
          } />
          <Route path="/rate/:orderId" element={
            <ProtectedRoute>
              <RateOrder />
            </ProtectedRoute>
          } />
          <Route path="/order-success" element={
            <OrderSuccess />
          } />

          {/* Rutas de perfil */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/profile/edit" element={<Navigate to="/profile" replace />} />

          {/* Rutas protegidas para administradores */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute requireRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Rutas protegidas para conductores (página principal del conductor = mapa) */}
          <Route path="/driver" element={<Navigate to="/driver/map" replace />} />
          <Route path="/driver/map" element={
            <ProtectedRoute requireRole="driver">
              <DriverDashboard />
            </ProtectedRoute>
          } />
          <Route path="/driver/orders" element={
            <ProtectedRoute requireRole="driver">
              <DriverOrders />
            </ProtectedRoute>
          } />
          <Route path="/driver/orders/:orderId" element={
            <ProtectedRoute requireRole="driver">
              <DriverOrderDetail />
            </ProtectedRoute>
          } />

          {/* Ruta por defecto - redirige al home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

// Exportación del componente App
export default App;