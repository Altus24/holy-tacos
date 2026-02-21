// Modelo de Pedido para Holy Tacos
// Este modelo representa los pedidos realizados por los usuarios
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // ID del usuario que realizó el pedido
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El ID del usuario es obligatorio']
  },

  // ID del restaurante del cual se hace el pedido
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: [true, 'El ID del restaurante es obligatorio']
  },

  // Items del pedido como array de objetos
  items: [{
    // Nombre del platillo
    name: {
      type: String,
      required: [true, 'El nombre del item es obligatorio']
    },

    // Precio unitario del item
    price: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [0, 'El precio debe ser positivo']
    },

    // Cantidad del item
    quantity: {
      type: Number,
      required: [true, 'La cantidad es obligatoria'],
      min: [1, 'La cantidad debe ser al menos 1']
    },

    // Subtotal calculado (precio * cantidad)
    subtotal: {
      type: Number,
      default: function() {
        return this.price * this.quantity;
      }
    }
  }],

  // Estado del pedido - Flujo lineal: pending → assigned → heading_to_restaurant → ready_for_pickup → at_restaurant → on_the_way → delivered → completed
  status: {
    type: String,
    enum: [
      'pending',           // Cliente creó la orden
      'assigned',          // Admin asignó driver
      'heading_to_restaurant',  // Driver va a recoger al restaurante
      'ready_for_pickup',  // Admin marcó "Pedido listo"
      'at_restaurant',     // Driver está en el restaurante (recogiendo)
      'on_the_way',       // Driver va a entregar al cliente
      'delivered',        // Driver marcó entregado
      'completed',        // Cliente confirmó la entrega
      'cancelled', 'cancelled_by_client', 'cancelled_by_client_with_penalty',
      'cancelled_by_admin', 'cancelled_by_admin_with_penalty', 'cancelled_by_driver'
    ],
    default: 'pending'
  },

  // Dirección de entrega
  deliveryAddress: {
    type: String,
    required: [true, 'La dirección de entrega es obligatoria'],
    trim: true
  },

  // Coordenadas del restaurante (para mapas)
  restaurantLocation: {
    lat: { type: Number },
    lng: { type: Number }
  },

  // Coordenadas de entrega del cliente (para mapas)
  deliveryLocation: {
    lat: { type: Number },
    lng: { type: Number }
  },

  // ID del conductor asignado (opcional)
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Información de pago con Stripe
  paymentIntentId: {
    type: String,
    default: null
  },

  // Estado del pago
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'cancelled'],
    default: 'pending'
  },

  // ID de la sesión de checkout de Stripe
  checkoutSessionId: {
    type: String,
    default: null
  },

  // Información de precios
  subtotal: {
    type: Number,
    default: 0
  },

  // Costo de entrega
  deliveryFee: {
    type: Number,
    default: 25 // Costo fijo de entrega en pesos
  },

  // Total del pedido
  total: {
    type: Number,
    default: 0
  },

  // Información adicional del pedido
  notes: {
    type: String,
    trim: true
  },

  // Palabra de seguridad compartida entre cliente y driver para confirmar la entrega
  safetyWord: {
    type: String,
    default: null,
    trim: true
  },

  // Fechas importantes
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Fecha de entrega estimada
  estimatedDeliveryTime: {
    type: Date
  },

  // Fecha real de entrega
  deliveredAt: {
    type: Date
  },

  // === Campos de cancelación ===

  // Motivo de cancelación (texto libre del cliente)
  cancellationReason: {
    type: String,
    default: '',
    trim: true
  },

  // Fecha en que se canceló el pedido
  cancelledAt: {
    type: Date,
    default: null
  },

  // Usuario que canceló el pedido
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Rol del usuario que canceló ('client' o 'admin')
  cancelledByRole: {
    type: String,
    enum: ['client', 'admin', null],
    default: null
  },

  // Monto de penalidad retenido (10% si estaba pagado)
  penaltyAmount: {
    type: Number,
    default: 0
  },

  // Monto a reembolsar al cliente
  refundAmount: {
    type: Number,
    default: 0
  },

  // Historial de cambios de estado para auditoría (cada cambio registra quién y cuándo)
  statusHistory: [{
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    role: { type: String, trim: true }, // 'client', 'admin', 'driver', 'system'
    notes: { type: String, trim: true } // notas opcionales (ej: detalles de reasignación)
  }],

  // Calificación del conductor por el cliente (después de confirmar recepción)
  driverRating: {
    stars: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, default: '' },
    ratedAt: { type: Date, default: Date.now }
  },

  // Calificación del restaurante/servicio por el cliente
  restaurantRating: {
    stars: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, default: '' },
    ratedAt: { type: Date, default: Date.now }
  }
});

// Middleware para calcular totales antes de guardar
orderSchema.pre('save', function(next) {
  // Calcular subtotal sumando todos los items
  this.subtotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Calcular total incluyendo costo de entrega
  this.total = this.subtotal + this.deliveryFee;

  this.updatedAt = Date.now();
  next();
});

// Índice para búsquedas por usuario
orderSchema.index({ userId: 1 });

// Índice para búsquedas por restaurante
orderSchema.index({ restaurantId: 1 });

// Índice para búsquedas por conductor
orderSchema.index({ driverId: 1 });

// Índice para filtrar por estado
orderSchema.index({ status: 1 });

// Índice para órdenes recientes
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);