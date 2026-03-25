/**
 * Route aggregator for @ascendstack/vectordb.
 * Mounts all sub-routers under their respective API path prefixes.
 * Health routes are unauthenticated; all others require tenant + auth middleware.
 */

import { Router } from 'express';
import { healthRouter } from './health.routes';
import { tenantRouter } from './tenant.routes';
import { workflowRouter } from './workflow.routes';
import { executionRouter } from './execution.routes';
import { eventRouter } from './event.routes';
import { documentRouter } from './document.routes';
import { vectorRouter } from './vector.routes';
import { memoryRouter } from './memory.routes';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';

export const apiRouter = Router();

// Unauthenticated health checks
apiRouter.use('/health', healthRouter);

// Tenant provisioning (no tenant middleware – bootstrapping)
apiRouter.use('/tenants', tenantRouter);

// All routes below require authentication and tenant context
apiRouter.use(authMiddleware);
apiRouter.use(tenantMiddleware);

apiRouter.use('/workflows', workflowRouter);
apiRouter.use('/executions', executionRouter);
apiRouter.use('/events', eventRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/vectors', vectorRouter);
apiRouter.use('/memory', memoryRouter);
