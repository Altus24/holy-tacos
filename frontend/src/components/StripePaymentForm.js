// Componente de pago simulado con Stripe para Holy Tacos
import React, { useState } from 'react';
import axios from 'axios';

// Componente interno que maneja el formulario de pago
const PaymentForm = ({ amount, onPaymentSuccess, onPaymentError }) => {
  const [loading, setLoading] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Función para validar número de tarjeta (Algoritmo de Luhn)
  const validateCardNumber = (number) => {
    const cleaned = number.replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) return false;

    let sum = 0;
    let shouldDouble = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  };

  // Función para validar fecha de expiración
  const validateExpiry = (expiry) => {
    const match = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;

    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10) + 2000;
    const now = new Date();
    const expiryDate = new Date(year, month - 1);

    return month >= 1 && month <= 12 && expiryDate > now;
  };

  // Función para validar CVC
  const validateCVC = (cvc) => {
    return /^\d{3,4}$/.test(cvc);
  };

  // Función para formatear número de tarjeta
  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const match = cleaned.match(/\d{4,16}/g);
    if (match) {
      return match.join(' ').substr(0, 19);
    }
    return cleaned.substr(0, 19);
  };

  // Función para formatear fecha de expiración
  const formatExpiry = (value) => {
    const cleaned = value.replace(/\D+/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substr(0, 2) + '/' + cleaned.substr(2, 2);
    }
    return cleaned;
  };

  // Manejar cambios en los campos
  const handleInputChange = (field, value) => {
    let formattedValue = value;

    if (field === 'number') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiry') {
      formattedValue = formatExpiry(value);
    } else if (field === 'cvc') {
      formattedValue = value.replace(/\D/g, '').substr(0, 4);
    }

    setCardData(prev => ({
      ...prev,
      [field]: formattedValue
    }));

    // Limpiar errores de validación para este campo
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const errors = {};

    if (!cardData.number || !validateCardNumber(cardData.number)) {
      errors.number = 'Número de tarjeta inválido';
    }

    if (!cardData.expiry || !validateExpiry(cardData.expiry)) {
      errors.expiry = 'Fecha de expiración inválida';
    }

    if (!cardData.cvc || !validateCVC(cardData.cvc)) {
      errors.cvc = 'Código CVC inválido';
    }

    if (!cardData.name.trim()) {
      errors.name = 'Nombre del titular requerido';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validar formulario antes de enviar
    if (!validateForm()) {
      setCardError('Por favor corrige los errores en el formulario');
      onPaymentError('Por favor corrige los errores en el formulario');
      return;
    }

    setLoading(true);
    setCardError('');

    try {
      // Simular tarjetas rechazadas para testing
      const cardNumber = cardData.number.replace(/\s/g, '');
      const isRejectedCard = cardNumber === '4000000000000002';

      // Crear sesión de pago simulada
      const sessionResponse = await axios.post('/api/payment/create-session', {
        amount: amount,
        currency: 'mxn',
        description: `Pedido Holy Tacos - $${amount} MXN`
      });

      if (!sessionResponse.data.success) {
        throw new Error(sessionResponse.data.message);
      }

      // Simular tiempo de procesamiento
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simular rechazo de pago si es la tarjeta de prueba rechazada
      if (isRejectedCard) {
        throw new Error('Su tarjeta ha sido rechazada. Verifique sus datos o intente con otra tarjeta.');
      }

      // Confirmar el pago simulado
      const confirmResponse = await axios.post('/api/payment/confirm', {
        sessionId: sessionResponse.data.data.id,
        paymentMethodId: 'pm_simulated_card',
        cardData: {
          number: cardData.number,
          expiry: cardData.expiry,
          cvc: cardData.cvc,
          name: cardData.name
        }
      });

      if (confirmResponse.data.success) {
        onPaymentSuccess({
          ...confirmResponse.data.data,
          cardInfo: {
            last4: cardData.number.slice(-4),
            brand: getCardBrand(cardData.number)
          }
        });
      } else {
        throw new Error(confirmResponse.data.message);
      }
    } catch (error) {
      console.error('Error en pago:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al procesar el pago';
      setCardError(errorMessage);
      onPaymentError(errorMessage);

      // No limpiar el formulario aquí para evitar duplicación
      // El usuario puede corregir errores sin perder datos
    } finally {
      setLoading(false);
    }
  };

  // Función para detectar marca de tarjeta
  const getCardBrand = (cardNumber) => {
    const number = cardNumber.replace(/\s/g, '');
    if (number.startsWith('4')) return 'Visa';
    if (number.startsWith('5') || number.startsWith('2')) return 'Mastercard';
    if (number.startsWith('3')) return 'American Express';
    return 'Unknown';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información del monto */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-orange-800 font-medium">Total a pagar:</span>
          <span className="text-2xl font-bold text-orange-600">${amount} MXN</span>
        </div>
      </div>

      {/* Campos de tarjeta de crédito */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Número de tarjeta *
          </label>
          <input
            type="text"
            value={cardData.number}
            onChange={(e) => handleInputChange('number', e.target.value)}
            placeholder="1234 5678 9012 3456"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              validationErrors.number ? 'border-red-500' : 'border-gray-300'
            }`}
            maxLength="19"
          />
          {validationErrors.number && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.number}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de expiración *
            </label>
            <input
              type="text"
              value={cardData.expiry}
              onChange={(e) => handleInputChange('expiry', e.target.value)}
              placeholder="MM/YY"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                validationErrors.expiry ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength="5"
            />
            {validationErrors.expiry && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.expiry}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CVC *
            </label>
            <input
              type="text"
              value={cardData.cvc}
              onChange={(e) => handleInputChange('cvc', e.target.value)}
              placeholder="123"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                validationErrors.cvc ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength="4"
            />
            {validationErrors.cvc && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.cvc}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del titular *
          </label>
          <input
            type="text"
            value={cardData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Como aparece en la tarjeta"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              validationErrors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {validationErrors.name && (
            <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>
          )}
        </div>
      </div>

      {/* Mostrar error si existe */}
      {cardError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {cardError}
        </div>
      )}

      {/* Botón de pago */}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Procesando pago...
          </>
        ) : (
          <>
            <span className="mr-2">💳</span>
            Pagar ${amount} MXN
          </>
        )}
      </button>

      {/* Información de seguridad */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span className="text-green-600">🔒</span>
          <span>Pago seguro procesado por Stripe</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tus datos de pago están protegidos y encriptados. No guardamos información de tarjetas.
        </p>
      </div>

      {/* Información de tarjetas de prueba */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-blue-800 font-medium mb-2">💳 Tarjetas de prueba</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <code className="bg-white px-2 py-1 rounded">4242 4242 4242 4242</code>
            <span className="text-green-600">✅ Éxito</span>
          </div>
          <div className="flex justify-between items-center">
            <code className="bg-white px-2 py-1 rounded">4000 0000 0000 0002</code>
            <span className="text-red-600">❌ Rechazada</span>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Usa cualquier fecha futura (MM/YY) y CVC (123). Nombre: "Test User"
          </p>
        </div>
      </div>
    </form>
  );
};

// Componente principal del formulario de pago
const StripePaymentForm = ({ amount, onPaymentSuccess, onPaymentError }) => {
  return (
    <PaymentForm
      amount={amount}
      onPaymentSuccess={onPaymentSuccess}
      onPaymentError={onPaymentError}
    />
  );
};

export default StripePaymentForm;