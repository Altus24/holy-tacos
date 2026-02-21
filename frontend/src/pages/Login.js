// Página de inicio de sesión para Holy Tacos
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        // Verificar si hay una URL de redirección guardada
        const redirectUrl = localStorage.getItem('redirectAfterLogin');
        if (redirectUrl) {
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectUrl);
          return;
        }

        // Redirigir según el rol del usuario
        if (result.user.role === 'admin') {
          navigate('/admin/dashboard');
        } else if (result.user.role === 'driver') {
          navigate('/driver/map');
        } else {
          navigate('/');
        }
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

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
              Iniciar Sesión
            </h2>
            <p className="mt-2 text-gray-600">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-orange-600 hover:text-orange-700 font-medium">
                Regístrate aquí
              </Link>
            </p>
          </div>

          {/* Formulario */}
          <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Campo de email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Correo electrónico
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
                  Contraseña
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Tu contraseña"
                  />
                </div>
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
                      Iniciando sesión...
                    </div>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </div>
            </form>

            {/* Información adicional */}
            <div className="mt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  ¿Olvidaste tu contraseña?{' '}
                  <a href="#" className="text-orange-600 hover:text-orange-700 font-medium">
                    Recupérala aquí
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Información sobre credenciales de prueba */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              Credenciales de prueba:
            </h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>Admin:</strong> admin@holy-tacos.com / admin123</p>
              <p><strong>Usuario de prueba:</strong> test@example.com / 123456</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;