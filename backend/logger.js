/**
 * Logger estructurado con Pino para Holy Tacos.
 * En desarrollo usa pino-pretty para salida legible.
 */
const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' }
    }
  })
});

module.exports = logger;
