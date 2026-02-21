// Página de registro para Holy Tacos
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'client'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Validar el formulario
  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Todos los campos son obligatorios');
      return false;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Formato de email inválido');
      return false;
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const result = await register(formData.email, formData.password, formData.role);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          // Redirigir según el rol del usuario
          if (result.user.role === 'admin') {
            navigate('/admin/dashboard');
          } else if (result.user.role === 'driver') {
            navigate('/driver/map');
          } else {
            navigate('/');
          }
        }, 2000);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4">
          <div className="max-w-md w-full">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
              ¡Registro exitoso! Redirigiendo...
            </div>
            <div className="bg-white py-8 px-6 shadow-lg rounded-lg text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Registro completado!
              </h2>
              <p className="text-gray-600">
                Tu cuenta ha sido creada exitosamente. Serás redirigido automáticamente.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="flex justify-start">
            <BackButton to="/" label="Volver al Inicio" variant="link" />
          </div>
          {/* Encabezado */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Crear Cuenta
            </h2>
            <p className="mt-2 text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-orange-600 hover:text-orange-700 font-medium">
                Inicia sesión aquí
              </Link>
            </p>
          </div>

          {/* Formulario */}
          <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Campo de email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Correo electrónico *
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              {/* Campo de contraseña */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Contraseña *
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              {/* Campo de confirmar contraseña */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirmar contraseña *
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Repite tu contraseña"
                  />
                </div>
              </div>

              {/* Campo de rol */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Tipo de cuenta
                </label>
                <div className="mt-1">
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="client">Cliente (para pedir comida)</option>
                    <option value="driver">Conductor (para hacer entregas)</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Los administradores deben ser creados por el sistema
                </p>
              </div>

              {/* Mostrar error si existe */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Botón de envío */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creando cuenta...
                    </div>
                  ) : (
                    'Crear Cuenta'
                  )}
                </button>
              </div>
            </form>

            {/* Términos y condiciones */}
            <div className="mt-6">
              <p className="text-xs text-gray-600 text-center">
                Al crear una cuenta, aceptas nuestros{' '}
                <a href="#" className="text-orange-600 hover:text-orange-700">
                  términos y condiciones
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Register;