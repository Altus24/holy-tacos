// Rutas de pagos con Stripe para Holy Tacos
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  createCheckoutSession,
  verifyPayment
} = require('../controllers/paymentController');

const router = express.Router();

// POST /api/payment/create-checkout-session - Crear sesión de checkout con Stripe
// Crea una sesión de pago completa que redirige al usuario a Stripe
router.post('/create-checkout-session', authenticateToken, createCheckoutSession);

// GET /api/payment/verify - Verificar estado del pago después del checkout
router.get('/verify', (req, res, next) => {
  // Si hay session_id, permitir acceso sin autenticación completa
  if (req.query.session_id) {
    return next();
  }
  // Si no hay session_id, requerir autenticación completa
  return authenticateToken(req, res, next);
}, verifyPayment);

// El webhook POST se registra en server.js con body raw (antes de express.json()).
// GET /api/payment/webhook: solo informativo (Stripe envía POST; si abrís la URL en el navegador verás esto).
router.get('/webhook', (req, res) => {
  res.status(200).json({
    message: 'Webhook de Stripe: este endpoint solo acepta peticiones POST enviadas por Stripe. No abras esta URL en el navegador.',
    uso: 'Para probar en local: stripe listen --forward-to localhost:5000/api/payment/webhook (en la terminal, no en la consola del navegador).'
  });
});

// POST /api/payment/create-session - Endpoint de compatibilidad (redirige a checkout session)
router.post('/create-session', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'mxn', description = 'Pedido Holy Tacos' } = req.body;

    // Validar datos requeridos
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Monto es requerido y debe ser mayor a 0'
      });
    }

    // Para compatibilidad, crear una sesión simulada (sin redirección a Stripe)
    const sessionId = `cs_sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientSecret = `pi_sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_secret`;

    console.log(`💳 Sesión de pago simulada creada para ${req.user.email}: $${amount} ${currency}`);

    res.json({
      success: true,
      message: 'Sesión de pago creada exitosamente (simulada)',
      data: {
        id: sessionId,
        client_secret: clientSecret,
        amount_total: amount,
        currency: currency.toUpperCase(),
        status: 'requires_payment_method',
        payment_status: 'unpaid',
        metadata: {
          userId: req.user._id.toString(),
          description,
          simulated: true
        },
        created: Math.floor(Date.now() / 1000)
      }
    });
  } catch (error) {
    console.error('Error al crear sesión de pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el pago'
    });
  }
});

// POST /api/payment/confirm - Confirmar pago simulado (para compatibilidad)
router.post('/confirm', authenticateToken, async (req, res) => {
  try {
    const { sessionId, paymentMethodId } = req.body;

    // Validar datos requeridos
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'ID de sesión es requerido'
      });
    }

    // Para simulación, "confirmamos" el pago con un 80% de éxito
    const isSuccess = Math.random() > 0.2; // 80% de éxito, 20% de fallo

    if (isSuccess) {
      // Pago exitoso
      console.log(`✅ Pago confirmado para sesión ${sessionId} - Usuario: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Pago procesado exitosamente',
        data: {
          sessionId,
          status: 'succeeded',
          payment_status: 'paid',
          amount_paid: 0, // Se calculará desde el pedido
          simulated: true
        }
      });
    } else {
      // Pago fallido (simulación)
      console.log(`❌ Pago fallido para sesión ${sessionId} - Usuario: ${req.user.email}`);

      res.status(402).json({
        success: false,
        message: 'Pago rechazado (simulación de error)',
        error: {
          type: 'card_error',
          code: 'card_declined',
          message: 'Tu tarjeta fue rechazada.'
        }
      });
    }
  } catch (error) {
    console.error('Error al confirmar pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la confirmación del pago'
    });
  }
});

// GET /api/payment/test-success - Simular página de éxito
// Endpoint para probar la página de éxito sin hacer pago real
router.get('/test-success', (req, res) => {
  res.json({
    success: true,
    message: 'Pago simulado exitoso',
    data: {
      orderId: 'test-order-123',
      paymentStatus: 'paid',
      amountTotal: 5000,
      currency: 'mxn',
      customerEmail: 'test@example.com'
    }
  });
});

// GET /api/payment/test-card - Información de tarjetas de prueba
// Endpoint útil para mostrar tarjetas de prueba al usuario
router.get('/test-card', (req, res) => {
  res.json({
    success: true,
    message: 'Tarjetas de prueba para simulación',
    data: {
      cards: [
        {
          number: '4242 4242 4242 4242',
          expiry: '12/25',
          cvc: '123',
          description: 'Tarjeta exitosa'
        },
        {
          number: '4000 0000 0000 0002',
          expiry: '12/25',
          cvc: '123',
          description: 'Tarjeta rechazada'
        },
        {
          number: '4000 0025 0000 3155',
          expiry: '12/25',
          cvc: '123',
          description: 'Requiere autenticación 3D'
        }
      ],
      note: 'Estas son tarjetas simuladas. En producción, usa tarjetas reales de Stripe.'
    }
  });
});

module.exports = router;