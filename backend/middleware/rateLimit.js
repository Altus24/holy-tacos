/**
 * Rate limiting para proteger la API (login, registro, etc.)
 */
const rateLimit = require('express-rate-limit');
const logger = require('../logger');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máx 50 intentos por ventana (login + register + verify)
  message: { success: false, message: 'Demasiados intentos. Intentá de nuevo en unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit excedido');
    res.status(429).json(options.message);
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 120, // 120 requests por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'API rate limit excedido');
    res.status(429).json({ success: false, message: 'Demasiadas peticiones.' });
  }
});

module.exports = { authLimiter, apiLimiter };
