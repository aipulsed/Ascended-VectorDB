/**
 * Tenant middleware for @ascendstack/vectordb.
 * Extracts and validates the tenant identifier from the X-Tenant-Id request header.
 * Attaches tenantId to the Express Request object for downstream handlers.
 */

import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../services/tenant.service';
import { logger } from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
    }
  }
}

/**
 * Express middleware that enforces the presence of the X-Tenant-Id header
 * and validates the tenant exists and is active.
 */
export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId || typeof tenantId !== 'string') {
    res.status(400).json({ error: 'X-Tenant-Id header required' });
    return;
  }

  try {
    const isValid = await tenantService.validateTenant(tenantId);
    if (!isValid) {
      res.status(403).json({ error: 'Tenant not found or inactive' });
      return;
    }

    req.tenantId = tenantId;
    next();
  } catch (error) {
    logger.error('Tenant middleware error', { tenantId, error });
    res.status(500).json({ error: 'Internal server error' });
  }
};
