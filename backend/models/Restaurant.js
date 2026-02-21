// Modelo de Restaurante para Holy Tacos
// Este modelo representa los restaurantes disponibles en la plataforma
const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  // Nombre del restaurante
  name: {
    type: String,
    required: [true, 'El nombre del restaurante es obligatorio'],
    trim: true
  },

  // Dirección completa del restaurante
  address: {
    type: String,
    required: [true, 'La dirección es obligatoria'],
    trim: true
  },

  // Ubicación geográfica del restaurante (formato GeoJSON)
  // Permite consultas geoespaciales como "restaurantes cercanos"
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat] - formato GeoJSON estándar
      default: [0, 0]
    }
  },

  // Menú del restaurante como array de objetos
  menu: [{
    // Nombre del platillo
    name: {
      type: String,
      required: [true, 'El nombre del platillo es obligatorio'],
      trim: true
    },

    // Precio del platillo en pesos
    price: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [0, 'El precio debe ser positivo']
    },

    // Descripción opcional del platillo
    description: {
      type: String,
      trim: true
    },

    // Categoría del platillo (opcional)
    category: {
      type: String,
      enum: ['entrada', 'plato principal', 'bebida', 'postre'],
      default: 'plato principal'
    }
  }],

  // Estado del restaurante (activo/inactivo)
  isActive: {
    type: Boolean,
    default: true
  },

  // Información adicional para administración
  description: {
    type: String,
    trim: true
  },

  // Imagen del restaurante
  image: {
    type: String,
    default: null
  },

  // Calificación promedio
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },

  // Total de pedidos realizados
  totalOrders: {
    type: Number,
    default: 0
  },

  // Información de contacto
  phone: {
    type: String,
    trim: true
  },

  // Fecha de creación
  createdAt: {
    type: Date,
    default: Date.now
  },

  // Fecha de última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para actualizar la fecha de modificación antes de guardar
restaurantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Índice para búsquedas por nombre
restaurantSchema.index({ name: 1 });

// Índice para filtrar restaurantes activos
restaurantSchema.index({ isActive: 1 });

// Índice geoespacial para consultas de proximidad (restaurantes cercanos)
restaurantSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Restaurant', restaurantSchema);