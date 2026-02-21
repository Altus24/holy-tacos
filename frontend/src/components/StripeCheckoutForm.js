// Componente de pago con Stripe Checkout Session para Holy Tacos
// Redirige al usuario a la página de pago segura de Stripe
import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const StripeCheckoutForm = ({ amount, orderId, onPaymentSuccess, onPaymentError }) => {
  const { isAuthenticated } = useAuth();
  const { disconnect } = useSocket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Función para iniciar el proceso de pago con Stripe
  const handlePayment = async () => {
    if (!isAuthenticated()) {
      setError('Debes iniciar sesión para procesar el pago.');
      onPaymentError('Debes iniciar sesión para procesar el pago.');
      return;
    }

    if (!orderId) {
      setError('No se pudo identificar el pedido. Inténtalo de nuevo.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Crear sesión de checkout en el backend
      const response = await axios.post('/api/payment/create-checkout-session', {
        orderId: orderId,
        amount: Math.round(amount * 100), // Convertir a centavos para Stripe
        currency: 'mxn'
      });

      if (response.data.success) {
        const { sessionUrl } = response.data.data;

        console.log('💳 Redirigiendo a Stripe para pago...');

        // Desconectar socket antes de redirigir (es completamente normal)
        // Cuando el navegador navega a Stripe, pierde la conexión WebSocket
        disconnect();

        // Redirigir al usuario a la página de Stripe
        window.location.href = sessionUrl;
      } else {
        throw new Error(response.data.message || 'Error al crear la sesión de pago');
      }

    } catch (error) {
      console.error('❌ Error al procesar el pago:', error);

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Error al procesar el pago. Inténtalo de nuevo.';

      setError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Información del monto */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-orange-900">Resumen del pago</h3>
            <p className="text-sm text-orange-700 mt-1">Pedido #{orderId?.slice(-6)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-orange-700">Total a pagar</p>
            <p className="text-3xl font-bold text-orange-600">${amount} MXN</p>
          </div>
        </div>
      </div>

      {/* Información de seguridad */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">🔒</div>
          <div>
            <h4 className="font-semibold text-blue-900">Pago seguro con Stripe</h4>
            <p className="text-sm text-blue-700">
              Serás redirigido a una página segura de Stripe para completar tu pago.
              No almacenamos información de tu tarjeta.
            </p>
          </div>
        </div>
      </div>

      {/* Mostrar error si existe */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <div className="flex items-center">
            <span className="mr-2">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Botón de pago */}
      <button
        onClick={handlePayment}
        disabled={loading || !orderId}
        className="w-full bg-orange-600 text-white py-4 px-6 rounded-lg hover:bg-orange-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
            Procesando...
          </>
        ) : (
          <>
            <span className="mr-2">💳</span>
            Pagar con Stripe
          </>
        )}
      </button>

      {/* Información adicional */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Al hacer clic en "Pagar con Stripe", serás redirigido a Stripe para completar tu pago de forma segura.
        </p>
      </div>

      {/* Métodos de pago aceptados */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2 text-center">Métodos de pago aceptados</h4>
        <div className="flex justify-center items-center space-x-4 text-sm text-gray-600">
          <span>💳 Tarjetas de crédito/débito</span>
          <span>•</span>
          <span>🏦 Transferencias bancarias</span>
          <span>•</span>
          <span>📱 Pagos móviles</span>
        </div>
      </div>

      {/* Enlaces de ayuda */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          ¿Necesitas ayuda? Contacta a nuestro soporte o visita{' '}
          <a
            href="https://stripe.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            la documentación de Stripe
          </a>
        </p>
      </div>
    </div>
  );
};

export default StripeCheckoutForm;