/**
 * Health check routes for @ascendstack/vectordb.
 * Exposes liveness and readiness endpoints for orchestrators (Kubernetes, Docker).
 * /health – basic uptime check
 * /health/db – PostgreSQL connectivity check
 * /health/redis – Redis connectivity check
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { getRedisClient } from '../../lib/redis';
import { logger } from '../../lib/logger';

export const healthRouter = Router();

/** Basic liveness probe. */
healthRouter.get('/', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Database connectivity check via a lightweight query. */
healthRouter.get('/db', async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    logger.error('Database health check failed', { error });
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

/** Redis connectivity check via a PING command. */
healthRouter.get('/redis', async (_req: Request, res: Response): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) {
    res.json({ status: 'ok', redis: 'not configured' });
    return;
  }

  try {
    await redis.ping();
    res.json({ status: 'ok', redis: 'connected' });
  } catch (error) {
    logger.error('Redis health check failed', { error });
    res.status(503).json({ status: 'error', redis: 'disconnected' });
  }
});
