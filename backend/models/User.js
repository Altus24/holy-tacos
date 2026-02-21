// Modelo de Usuario para Holy Tacos
// Este modelo representa a los usuarios del sistema (clientes, administradores, conductores)
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Correo electrónico único del usuario
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true
  },

  // Contraseña hasheada (nunca se almacena en texto plano)
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
  },

  // Rol del usuario en el sistema
  role: {
    type: String,
    enum: ['client', 'admin', 'driver'],
    default: 'client'
  },

  // Nombre del usuario (opcional para todos los roles)
  name: {
    type: String,
    trim: true
  },

  // Campos comunes para todos los roles

  // Teléfono del usuario
  phone: {
    type: String,
    trim: true,
    match: [/^\+?\d{9,15}$/, 'Formato de teléfono inválido']
  },

  // Foto de perfil (URL de la imagen)
  profilePicture: {
    type: String,
    default: null
  },

  // Fecha de creación del usuario
  createdAt: {
    type: Date,
    default: Date.now
  },

  // Fecha de última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Perfil específico para clientes
  clientProfile: {
    // Dirección predeterminada de entrega
    defaultAddress: {
      street: { type: String, trim: true },
      number: { type: String, trim: true },
      floor: { type: String, trim: true },
      apartment: { type: String, trim: true },
      notes: { type: String, trim: true },
      // Ubicación geográfica en formato GeoJSON (mismo formato que restaurantes)
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
      },
      label: { type: String, trim: true, default: 'Casa' }
    },

    // Direcciones guardadas adicionales
    savedAddresses: [{
      street: { type: String, trim: true },
      number: { type: String, trim: true },
      floor: { type: String, trim: true },
      apartment: { type: String, trim: true },
      notes: { type: String, trim: true },
      // Ubicación geográfica en formato GeoJSON (mismo formato que restaurantes)
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
      },
      label: { type: String, trim: true }
    }],

    // Restaurantes favoritos
    favoriteRestaurants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant'
    }],

    // Preferencias dietéticas
    dietaryPreferences: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  },

  // Perfil específico para conductores
  driverProfile: {
    // Información del vehículo
    vehicle: {
      type: {
        type: String,
        enum: ['moto', 'auto', 'bicicleta', 'otro'],
        default: 'moto'
      },
      brand: { type: String, trim: true },
      model: { type: String, trim: true },
      plate: { type: String, trim: true, uppercase: true },
      color: { type: String, trim: true }
    },

    // Información de la licencia
    licenseNumber: { type: String, trim: true, uppercase: true },
    licenseExpiration: Date,

    // Documentos del conductor
    documents: {
      licenseFront: { type: String },      // URL del frente de la licencia
      licenseBack: { type: String },       // URL del reverso de la licencia
      profileVerification: { type: String } // URL de verificación (selfie o documento adicional)
    },

    // Zonas de trabajo del conductor
    workingAreas: [{
      type: String,
      trim: true
    }],

    // Estado de verificación del conductor (sistema granular)
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },

    // Notas/comentarios del admin sobre la verificación (motivo de rechazo, etc.)
    verificationNotes: {
      type: String,
      trim: true,
      default: ''
    },

    // Fecha en que se verificó (aprobó/rechazó) por última vez
    verifiedAt: {
      type: Date,
      default: null
    },

    // Historial de cambios de verificación
    verificationHistory: [{
      action: { type: String }, // 'submitted', 'approved', 'rejected', 'revoked'
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now },
      notes: { type: String, trim: true }
    }],

    // Campo legado mantenido por compatibilidad (derivado de verificationStatus)
    isVerified: {
      type: Boolean,
      default: false
    },

    // Disponibilidad actual del conductor
    isAvailable: {
      type: Boolean,
      default: false
    },

    // Estado activo/inactivo del conductor
    isActive: {
      type: Boolean,
      default: true
    },

    // Compartir ubicación en tiempo real con clientes y admin
    shareLocation: {
      type: Boolean,
      default: false
    },

    // Última vez que se compartió la ubicación
    lastLocationShared: {
      type: Date,
      default: null
    },

    // Ubicación actual del conductor
    currentLocation: {
      lat: Number,
      lng: Number,
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },

    // Calificación promedio del conductor
    rating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5
    },

    // Total de entregas realizadas
    totalDeliveries: {
      type: Number,
      default: 0
    }
  }
});

// Middleware para actualizar la fecha de modificación antes de guardar
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// El índice único ya está definido en el campo email, no necesitamos índice adicional

// Índices geoespaciales para consultas de proximidad en direcciones de clientes
userSchema.index({ 'clientProfile.defaultAddress.location': '2dsphere' });
userSchema.index({ 'clientProfile.savedAddresses.location': '2dsphere' });

module.exports = mongoose.model('User', userSchema);