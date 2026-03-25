/**
 * Winston logger singleton for @ascendstack/vectordb.
 * Outputs structured JSON in production and pretty-printed logs in development.
 * All modules should import this logger instead of using console directly.
 */

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  simple(),
);

/** Application-wide structured logger. */
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: config.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  defaultMeta: { service: '@ascendstack/vectordb' },
  transports: [
    new winston.transports.Console({
      silent: config.NODE_ENV === 'test',
    }),
  ],
});
