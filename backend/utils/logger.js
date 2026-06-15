/**
 * Structured JSON logger using Pino.
 * Redacts sensitive fields in production.
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info({ userId: user.id }, 'User logged in');
 *   logger.error({ err, endpoint: '/api/chat' }, 'API error');
 */

const pino = require('pino');

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'body.password',
  'body.token',
  'body.email',
];

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Plain JSON in production (parsed by Railway's log aggregator)
  // Pretty-print in development for readability
  transport:
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

module.exports = logger;
