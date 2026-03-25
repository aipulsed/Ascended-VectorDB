/**
 * Authentication middleware for @ascendstack/vectordb.
 * Validates API keys by hashing the incoming key and comparing to stored key hashes.
 * Must be used after the tenant middleware since it scopes key lookup to the tenant.
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Express middleware that authenticates requests via the Authorization header.
 * Expects the format: `Authorization: Bearer <api-key>`
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required (Bearer token)' });
    return;
  }

  const rawKey = authHeader.slice(7);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        key_hash: keyHash,
        is_active: true,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
    });

    if (!apiKey) {
      res.status(401).json({ error: 'Invalid or expired API key' });
      return;
    }

    // Update last_used_at asynchronously to avoid blocking the request
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { last_used_at: new Date() } })
      .catch((err: unknown) => logger.warn('Failed to update last_used_at', { error: err }));

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
