/**
 * Main Express application bootstrap for @ascendstack/vectordb.
 * Initialises the server, registers middleware, mounts API routes,
 * and handles graceful shutdown of database and cache connections.
 */

import express, { Request, Response } from 'express';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { disconnectRedis } from './lib/redis';
import { apiRouter } from './api/routes';
import { errorMiddleware } from './middleware/error.middleware';

export const app = express();

// ──────────────────────────────────────────────
// Core middleware
// ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: express.NextFunction) => {
  logger.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// ──────────────────────────────────────────────
// API routes
// ──────────────────────────────────────────────
app.use('/api/v1', apiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler (must be last)
app.use(errorMiddleware);

// ──────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully…');
  await prisma.$disconnect();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(config.PORT, () => {
    logger.info(`@ascendstack/vectordb listening on port ${config.PORT}`, {
      env: config.NODE_ENV,
      port: config.PORT,
    });
  });

  server.on('error', (err: Error) => {
    logger.error('Server error', { error: err.message });
    process.exit(1);
  });
}
