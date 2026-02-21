/**
 * Validación de rutas de autenticación con express-validator
 */
const { body, validationResult } = require('express-validator');

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('role').optional().isIn(['client', 'driver', 'admin']).withMessage('Rol inválido')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida')
];

const verifyValidation = [
  body('token').notEmpty().withMessage('Token requerido')
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      success: false,
      message: first.msg
    });
  }
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  verifyValidation,
  handleValidation
};
