// Router principal: rutas por rol (client/driver/admin), lazy loading, redirección según rol.
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Carga diferida de páginas para mejor tiempo de carga inicial
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Restaurants = lazy(() => import('./pages/Restaurants'));
const RestaurantDetail = lazy(() => import('./pages/RestaurantDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const RateOrder = lazy(() => import('./pages/RateOrder'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const DriverMapPage = lazy(() => import('./pages/driver/DriverMapPage'));
const DriverOrders = lazy(() => import('./pages/DriverOrders'));
const DriverOrderDetail = lazy(() => import('./pages/DriverOrderDetail'));
const DriverStats = lazy(() => import('./pages/driver/Stats'));
const DriverProfile = lazy(() => import('./pages/driver/Profile'));

// Fallback minimalista mientras carga una ruta lazy
const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
  </div>
);

// Ruta "/": conductores → mapa; resto → Home
const HomeOrDriverRedirect = () => {
  const { isAuthenticated, isDriver, loading } = useAuth();
  if (!loading && isAuthenticated() && isDriver()) {
    return <Navigate to="/driver/map" replace />;
  }
  return <Home />;
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App">
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Ruta principal: driver → mapa; client/anon → Home */}
            <Route path="/" element={<HomeOrDriverRedirect />} />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurant/:id" element={<RestaurantDetail />} />

            {/* Rutas solo cliente: driver que intente acceder → /driver/map */}
            <Route path="/cart" element={<PrivateRoute requireRole="client"><Cart /></PrivateRoute>} />
            <Route path="/checkout" element={<PrivateRoute requireRole="client"><Checkout /></PrivateRoute>} />
            <Route path="/orders" element={<PrivateRoute requireRole="client"><Orders /></PrivateRoute>} />
            <Route path="/orders/:orderId" element={<PrivateRoute requireRole="client"><OrderTracking /></PrivateRoute>} />
            <Route path="/rate/:orderId" element={<PrivateRoute requireRole="client"><RateOrder /></PrivateRoute>} />
            <Route path="/order-success" element={<OrderSuccess />} />

            {/* Perfil: client y driver */}
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/profile/edit" element={<Navigate to="/profile" replace />} />

            <Route path="/admin/dashboard" element={<PrivateRoute requireRole="admin"><AdminDashboard /></PrivateRoute>} />

            {/* Rutas conductor: /driver → mapa */}
            <Route path="/driver" element={<Navigate to="/driver/map" replace />} />
            <Route path="/driver/dashboard" element={<PrivateRoute requireRole="driver"><DriverDashboard /></PrivateRoute>} />
            <Route path="/driver/map" element={<PrivateRoute requireRole="driver"><DriverMapPage /></PrivateRoute>} />
            <Route path="/driver/orders" element={<PrivateRoute requireRole="driver"><DriverOrders /></PrivateRoute>} />
            <Route path="/driver/orders/:orderId" element={<PrivateRoute requireRole="driver"><DriverOrderDetail /></PrivateRoute>} />
            <Route path="/driver/stats" element={<PrivateRoute requireRole="driver"><DriverStats /></PrivateRoute>} />
            <Route path="/driver/profile" element={<PrivateRoute requireRole="driver"><DriverProfile /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;