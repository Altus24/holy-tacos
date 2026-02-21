// Context API para manejar la autenticación en Holy Tacos
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';

// Configurar axios: base URL desde variable de entorno (REACT_APP_API_URL)
axios.defaults.baseURL = API_BASE_URL;

// Interceptor para agregar token JWT a las peticiones
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuesta: 401 → limpiar token (el componente puede redirigir a login)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Context para la autenticación
const AuthContext = createContext();

// Hook personalizado para usar el contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

// Provider del contexto de autenticación
export const AuthProvider = ({ children }) => {
  // Estado del usuario autenticado
  const [user, setUser] = useState(null);

  // Estado de carga
  const [loading, setLoading] = useState(true);

  // Verificar si hay un token válido al cargar la aplicación
  useEffect(() => {
    const verificarToken = async () => {
      const token = localStorage.getItem('token');

      if (token) {
        try {
          // Verificar el token con el backend
          const response = await axios.post('/api/auth/verify', { token });

          if (response.data.success) {
            setUser(response.data.data);
          } else {
            // Token inválido, limpiar localStorage
            localStorage.removeItem('token');
          }
        } catch (error) {
          console.error('Error al verificar token:', error);
          // Token expirado o inválido, limpiar localStorage
          localStorage.removeItem('token');
        }
      }

      setLoading(false);
    };

    verificarToken();
  }, []);

  // Función para iniciar sesión
  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });

      if (response.data.success) {
        const { token, data: userData } = response.data;

        // Guardar token en localStorage
        localStorage.setItem('token', token);

        // Actualizar estado del usuario
        setUser(userData);

        return { success: true, user: userData };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar sesión'
      };
    }
  };

  // Función para registrarse
  const register = async (email, password, role = 'client') => {
    try {
      const response = await axios.post('/api/auth/register', {
        email,
        password,
        role
      });

      if (response.data.success) {
        const { token, data: userData } = response.data;

        // Guardar token en localStorage
        localStorage.setItem('token', token);

        // Actualizar estado del usuario
        setUser(userData);

        return { success: true, user: userData };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (error) {
      console.error('Error al registrarse:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrarse'
      };
    }
  };

  // Función para cerrar sesión
  const logout = () => {
    // Limpiar token del localStorage
    localStorage.removeItem('token');

    // Limpiar estado del usuario
    setUser(null);
  };

  // Funciones estables para no disparar bucles en useEffect de consumidores
  const isAuthenticated = useCallback(() => user !== null, [user]);
  const hasRole = useCallback((role) => user && user.role === role, [user]);

  // Función para refrescar/verificar el token del usuario (estable con useCallback para evitar bucles en useEffect que dependen de ella)
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setUser(null);
      return false;
    }

    try {
      const response = await axios.post('/api/auth/verify', { token });

      if (response.data.success) {
        setUser(response.data.data);
        return true;
      } else {
        localStorage.removeItem('token');
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Error al refrescar usuario:', error);
      localStorage.removeItem('token');
      setUser(null);
      return false;
    }
  }, []);

  // Función para verificar si el usuario es admin
  const isAdmin = useCallback(() => user?.role === 'admin', [user?.role]);
  // Función para verificar si el usuario es conductor
  const isDriver = useCallback(() => user?.role === 'driver', [user?.role]);

  // Valor del contexto (referencia estable para no disparar efectos innecesarios)
  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated,
    hasRole,
    refreshUser,
    isAdmin,
    isDriver
  }), [user, loading, isAuthenticated, hasRole, refreshUser, isAdmin, isDriver]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};