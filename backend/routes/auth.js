// Rutas de autenticación para Holy Tacos
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { registerValidation, loginValidation, verifyValidation, handleValidation } = require('../middleware/validateAuth');

const router = express.Router();

// Función para generar token JWT
const generarToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // Token válido por 24 horas
  );
};

// POST /api/auth/register - Registrar nuevo usuario
router.post('/register', registerValidation, handleValidation, async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Verificar si el usuario ya existe
    const usuarioExistente = await User.findOne({ email: email.toLowerCase() });
    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear el usuario con rol por defecto 'client' si no se especifica
    const nuevoUsuario = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'client' // Por defecto es cliente
    });

    const usuarioGuardado = await nuevoUsuario.save();

    // Generar token JWT
    const token = generarToken(
      usuarioGuardado._id,
      usuarioGuardado.email,
      usuarioGuardado.role
    );

    // Usuario autenticado exitosamente
    const usuarioRespuesta = {
      _id: usuarioGuardado._id,
      email: usuarioGuardado.email,
      role: usuarioGuardado.role,
      createdAt: usuarioGuardado.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: usuarioRespuesta,
      token: token
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);

    // Manejar errores de validación
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al registrar el usuario'
    });
  }
});

// POST /api/auth/login - Iniciar sesión y obtener token JWT
router.post('/login', loginValidation, handleValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar el usuario por email
    const usuario = await User.findOne({ email: email.toLowerCase() });
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar la contraseña usando bcrypt
    const contraseñaValida = await bcrypt.compare(password, usuario.password);
    if (!contraseñaValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token JWT
    const token = generarToken(
      usuario._id,
      usuario.email,
      usuario.role
    );

    // Usuario autenticado exitosamente - devolver datos completos (sin password)
    const usuarioCompleto = usuario.toObject();
    delete usuarioCompleto.password;

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: usuarioCompleto,
      token: token
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
});

// POST /api/auth/verify - Verificar token JWT (útil para frontend)
router.post('/verify', verifyValidation, handleValidation, async (req, res) => {
  try {
    const { token } = req.body;

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar el usuario para confirmar que aún existe (sin password)
    const usuario = await User.findById(decoded.userId).select('-password');
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Devolver datos completos del usuario (incluye driverProfile, clientProfile, etc.)
    res.json({
      success: true,
      message: 'Token válido',
      data: usuario
    });
  } catch (error) {
    console.error('Error al verificar token:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error al verificar token'
    });
  }
});

module.exports = router;