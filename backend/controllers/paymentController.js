// Controlador de pagos con Stripe para Holy Tacos
// Maneja sesiones de checkout y webhooks de Stripe
const Order = require('../models/Order');

// Función para obtener instancia de Stripe (lazy loading)
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY no está configurada en las variables de entorno');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

// Crear sesión de checkout con Stripe
const createCheckoutSession = async (req, res) => {
  try {
    const { orderId, amount, currency = 'mxn' } = req.body;

    console.log('💳 Creando sesión de checkout para orden:', orderId, 'monto:', amount);

    // Verificar que el usuario esté autenticado
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    console.log('👤 Usuario autenticado:', req.user._id, req.user.email);
    console.log('📦 Orden solicitada:', orderId);

    // Verificar que la orden existe y pertenece al usuario
    const order = await Order.findById(orderId).populate('userId', 'email');
    if (!order) {
      console.log('❌ Orden no encontrada:', orderId);
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    // Verificar que la orden pertenece al usuario autenticado
    if (req.user && order.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para esta orden'
      });
    }

    // Verificar que la orden no esté ya pagada
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Esta orden ya ha sido pagada'
      });
    }

    const stripe = getStripe();
    // Incluir dirección de entrega en metadata para Stripe (y en la descripción del ítem)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Pedido Holy Tacos #${orderId.slice(-6)}`,
              description: `Entrega a: ${order.deliveryAddress}`,
              images: ['https://via.placeholder.com/300x200?text=Holy+Tacos'],
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout`,
      metadata: {
        orderId: orderId,
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        deliveryAddress: (order.deliveryAddress || '').slice(0, 500)
      },
      customer_email: req.user.email,
      payment_intent_data: {
        metadata: {
          orderId: orderId,
          userId: req.user._id.toString()
        }
      }
    });

    // Actualizar la orden con el ID de la sesión de checkout
    await Order.findByIdAndUpdate(orderId, {
      checkoutSessionId: session.id,
      paymentStatus: 'pending'
    });


    res.status(200).json({
      success: true,
      message: 'Sesión de checkout creada exitosamente',
      data: {
        sessionId: session.id,
        sessionUrl: session.url,
        orderId: orderId
      }
    });

  } catch (error) {
    console.error('Error creando sesión de checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la sesión de pago',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verificar estado del pago después del checkout (página de éxito).
// Si Stripe indica paid y la orden aún no está marcada, actualizamos como fallback (por si el webhook tardó).
const verifyPayment = async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'ID de sesión requerido'
      });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const order = await Order.findOne({ checkoutSessionId: session_id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    if (req.user && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta orden'
      });
    }

    // Fallback: si Stripe dice paid y la orden sigue pending, actualizar (por si el webhook no llegó aún)
    if (session.payment_status === 'paid' && order.paymentStatus !== 'paid') {
      await Order.findByIdAndUpdate(order._id, {
        paymentStatus: 'paid',
        paymentIntentId: session.payment_intent || order.paymentIntentId
      });
      console.log('✅ verifyPayment: orden marcada como pagada (fallback)', order._id);
    }

    const updatedOrder = await Order.findById(order._id);
    res.status(200).json({
      success: true,
      message: 'Estado del pago verificado',
      data: {
        orderId: updatedOrder._id,
        paymentStatus: updatedOrder.paymentStatus,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email
      }
    });
  } catch (error) {
    console.error('Error verificando pago:', error);

    // Si es un error de Stripe (sesión no encontrada, etc.)
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(404).json({
        success: false,
        message: 'Sesión de pago no encontrada o expirada'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al verificar el pago',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Webhook para manejar eventos de Stripe (req.body debe ser el body raw; se registra en server.js antes de express.json)
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET no está configurada');
    return res.status(500).send('Webhook no configurado');
  }

  let event;
  try {
    const stripe = getStripe();
    // constructEvent espera body en bruto (Buffer o string) para verificar la firma
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Webhook recibido:', event.type, 'id:', event.id);
  } catch (err) {
    console.error('Webhook firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log('Evento no manejado:', event.type);
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error procesando webhook:', error);
    return res.status(500).json({ error: 'Error procesando webhook' });
  }
};

// Manejar checkout completado: marcar como pagada y opcionalmente actualizar dirección si Stripe la envió
const handleCheckoutCompleted = async (session) => {
  try {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      console.error('No orderId en metadata de checkout.session.completed');
      return;
    }

    if (session.payment_status !== 'paid') {
      console.log(`Checkout completado pero payment_status = ${session.payment_status} para orden ${orderId}`);
      return;
    }

    const updateData = {
      paymentStatus: 'paid',
      paymentIntentId: session.payment_intent || null
    };
    // Si Stripe devolvió dirección de envío (ej. shipping_address_collection), actualizar la orden
    const addr = session.shipping_details?.address || session.customer_details?.address;
    if (addr && addr.line1) {
      const line = [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
        .filter(Boolean).join(', ');
      updateData.deliveryAddress = line;
    }
    await Order.findByIdAndUpdate(orderId, updateData);
    console.log('✅ Pago completado para orden', orderId);
  } catch (error) {
    console.error('Error manejando checkout completado:', error);
    throw error;
  }
};

// Manejar payment intent exitoso (puede llegar además de checkout.session.completed)
const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) {
      console.error('No orderId en metadata de payment_intent.succeeded');
      return;
    }
    await Order.findByIdAndUpdate(orderId, { paymentStatus: 'paid' });
    console.log('💰 Payment Intent exitoso para orden', orderId);
  } catch (error) {
    console.error('Error manejando payment_intent.succeeded:', error);
    throw error;
  }
};

// Manejar payment intent fallido
const handlePaymentIntentFailed = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) {
      console.error('No orderId en metadata de payment_intent.payment_failed');
      return;
    }
    await Order.findByIdAndUpdate(orderId, { paymentStatus: 'failed' });
    console.log('❌ Payment Intent fallido para orden', orderId);
  } catch (error) {
    console.error('Error manejando payment_intent.payment_failed:', error);
    throw error;
  }
};

module.exports = {
  createCheckoutSession,
  verifyPayment,
  handleWebhook
};