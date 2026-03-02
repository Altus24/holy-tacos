/**
 * Ruta protegida por autenticación y rol.
 * Redirige a login si no está autenticado; si requireRole no coincide, redirige según rol actual
 * (driver → /driver/dashboard, admin → /admin/dashboard, client → /).
 */
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, requireRole }) => {
  const { isAuthenticated, hasRole, refreshUser, isDriver, isAdmin } = useAuth();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthValid, setIsAuthValid] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        setIsAuthValid(true);
        setCheckingAuth(false);
        return;
      }
      const refreshed = await refreshUser();
      setIsAuthValid(refreshed);
      setCheckingAuth(false);
    };
    checkAuth();
  }, [isAuthenticated, refreshUser]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthValid) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole && !hasRole(requireRole)) {
    if (isDriver()) return <Navigate to="/driver/map" replace />;
    if (isAdmin()) return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
