// Página de éxito después del pago con Stripe
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import axios from 'axios';

const OrderSuccess = () => {
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    console.log('🚀 OrderSuccess: Página cargada');
    console.log('📋 Session ID:', sessionId);
    console.log('👤 Usuario autenticado:', !!user);

    if (sessionId) {
      verifyPayment();
    } else {
      // Para testing: usar endpoint de prueba si no hay sessionId
      console.log('🧪 Usando modo de prueba (sin sessionId)');
      testPaymentSuccess();
    }
  }, [sessionId, user]);

  const testPaymentSuccess = async () => {
    try {
      const response = await axios.get('/api/payment/test-success');
      if (response.data.success) {
        setOrderDetails(response.data.data);
      }
    } catch (error) {
      console.error('Error en test:', error);
      setError('Error en modo de prueba');
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async () => {
    try {
      if (!sessionId) {
        throw new Error('No se recibió el ID de sesión de Stripe');
      }

      let attempts = 0;
      const maxAttempts = 10; // ~20 segundos de polling si el webhook tarda

      const doVerify = async () => {
        const response = await axios.get(`/api/payment/verify?session_id=${sessionId}`);
        if (!response.data.success) throw new Error(response.data.message || 'Error al verificar el pago');
        return response.data.data;
      };

      let data = await doVerify();
      // Si el backend aún no marcó como paid (webhook no llegó), hacer polling breve
      while (data.paymentStatus !== 'paid' && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        data = await doVerify();
        attempts++;
      }

      setOrderDetails(data);
      if (data.paymentStatus !== 'paid') {
        setError('El pago está siendo procesado. Revisa "Mis Pedidos" en unos instantes.');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Error desconocido al verificar el pago';
      if (errorMessage.includes('autenticado') || errorMessage.includes('sesión')) {
        setError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente para ver los detalles de tu pago.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verificando tu pago...
            </h2>
            <p className="text-gray-600">
              Esto puede tomar unos segundos.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 py-12 px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-6 text-red-600">⚠️</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Error al verificar el pago
            </h1>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            {sessionId && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600">
                  <strong>Session ID:</strong> {sessionId}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-4">
              <Link
                to="/login"
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/"
                className="border border-orange-600 text-orange-600 px-6 py-3 rounded-lg hover:bg-orange-50 transition-colors font-semibold"
              >
                Volver al Inicio
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-4 flex justify-start">
            <BackButton to="/" label="Volver al Inicio" variant="link" />
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Icono de éxito */}
            <div className="text-6xl mb-6">🎉</div>

            {/* Título */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              ¡Pago Exitoso! 🎉
            </h1>

            {/* Mensaje de confirmación */}
            <p className="text-gray-600 mb-6">
              Tu pedido ha sido confirmado y está siendo preparado.
              Recibirás actualizaciones sobre el estado de tu entrega.
            </p>

            {/* Información adicional si no está autenticado */}
            {!user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Inicia sesión para ver el estado completo de tu pedido y recibir notificaciones en tiempo real.
                </p>
              </div>
            )}

            {/* Detalles del pago */}
            {orderDetails && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-4">Detalles de tu pedido</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID del pedido:</span>
                    <span className="font-mono text-gray-900">{orderDetails.orderId?.slice(-6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto pagado:</span>
                    <span className="font-semibold text-green-600">
                      ${(orderDetails.amountTotal / 100).toFixed(2)} {orderDetails.currency?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado del pago:</span>
                    <span className="text-green-600 font-medium">Completado ✅</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span>{orderDetails.customerEmail}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Información adicional */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <span className="text-blue-600 text-xl">ℹ️</span>
                <div className="text-left">
                  <h4 className="font-medium text-blue-900 mb-1">
                    ¿Qué sigue?
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Tu restaurante comenzará a preparar el pedido</li>
                    <li>• Recibirás actualizaciones en tiempo real</li>
                    <li>• Un conductor será asignado para la entrega</li>
                    <li>• Puedes rastrear tu pedido desde "Mis Pedidos"</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/orders"
                className="bg-orange-600 text-white px-8 py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold flex items-center justify-center"
              >
                <span className="mr-2">📦</span>
                Ver Mis Pedidos
              </Link>
              <Link
                to="/"
                className="border border-orange-600 text-orange-600 px-8 py-3 rounded-lg hover:bg-orange-50 transition-colors font-semibold flex items-center justify-center"
              >
                <span className="mr-2">🏠</span>
                Volver al Inicio
              </Link>
            </div>

            {/* Información de soporte */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                ¿Necesitas ayuda? Contacta nuestro soporte o revisa el estado de tu pedido en cualquier momento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderSuccess;