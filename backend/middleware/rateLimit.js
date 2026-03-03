/**
 * Rate limiting para proteger la API (login, registro, etc.)
 * En desarrollo (NODE_ENV !== 'production') no se aplica límite para evitar 429 al probar.
 */
const rateLimit = require('express-rate-limit');
const logger = require('../logger');

const isProduction = process.env.NODE_ENV === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // máx 200 intentos por ventana (login, register, verify al cargar/refrescar la app)
  message: { success: false, message: 'Demasiados intentos. Intentá de nuevo en unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction, // sin límite en desarrollo
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit excedido');
    res.status(429).json(options.message);
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 400, // 400 requests por minuto por IP (Home, restaurantes, perfil, pedidos, etc.)
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction, // sin límite en desarrollo
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'API rate limit excedido');
    res.status(429).json({ success: false, message: 'Demasiadas peticiones. Intentá de nuevo en un minuto.' });
  }
});

module.exports = { authLimiter, apiLimiter };
