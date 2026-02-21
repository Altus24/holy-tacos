// Middleware de autenticación para Holy Tacos
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware para verificar token JWT y autenticar usuario
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuario en la base de datos
    const usuario = await User.findById(decoded.userId);
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Agregar información del usuario a la request
    req.user = {
      _id: usuario._id,
      email: usuario.email,
      role: usuario.role
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token expirado'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error de autenticación'
    });
  }
};

// Middleware para verificar rol de administrador
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticación requerida'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren permisos de administrador'
    });
  }

  next();
};

// Middleware para verificar rol de conductor
const requireDriver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticación requerida'
    });
  }

  if (req.user.role !== 'driver' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren permisos de conductor'
    });
  }

  next();
};

// Middleware para verificar que el usuario esté autenticado (cualquier rol)
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticación requerida'
    });
  }

  next();
};

// Middleware opcional para verificar propiedad de recursos
const requireOwnership = (resourceUserIdField) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    // Si es admin, permitir acceso
    if (req.user.role === 'admin') {
      return next();
    }

    // Si es el propietario del recurso, permitir acceso
    if (req.user._id.toString() === req[resourceUserIdField]?.toString()) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'Acceso denegado. No tienes permisos sobre este recurso'
    });
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireDriver,
  requireAuth,
  requireOwnership
};