/**
 * Tenant management routes for @ascendstack/vectordb.
 * POST /tenants       – provision a new tenant
 * GET  /tenants/:id   – retrieve tenant details
 */

import { Router, Request, Response } from 'express';
import { tenantService } from '../../services/tenant.service';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { createTenantSchema, idParamSchema } from '../../utils/validation';
import { logger } from '../../lib/logger';

export const tenantRouter = Router();

tenantRouter.post(
  '/',
  validateBody(createTenantSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenant = await tenantService.createTenant(req.body as {
        name: string;
        slug: string;
        plan?: string;
        metadata?: Record<string, unknown>;
      });
      res.status(201).json(tenant);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create tenant';
      logger.error('POST /tenants error', { error });
      res.status(400).json({ error: message });
    }
  },
);

tenantRouter.get(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenant = await tenantService.getTenant(req.params['id'] as string);
      res.json(tenant);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tenant not found';
      res.status(404).json({ error: message });
    }
  },
);
