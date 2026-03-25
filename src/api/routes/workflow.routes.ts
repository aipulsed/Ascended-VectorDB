/**
 * Workflow routes for @ascendstack/vectordb.
 * Full CRUD for workflow definitions, scoped per tenant.
 */

import { Router, Request, Response } from 'express';
import { workflowRepository } from '../../repositories/workflow.repository';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { createWorkflowSchema, idParamSchema, paginationSchema } from '../../utils/validation';
import { logger } from '../../lib/logger';
import { Prisma } from '@prisma/client';

export const workflowRouter = Router();

/** GET /workflows – list workflows for tenant */
workflowRouter.get(
  '/',
  validateQuery(paginationSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit } = req.query as { page: string; limit: string };
      const result = await workflowRepository.list(req.tenantId, {
        page: Number(page),
        limit: Number(limit),
      });
      res.json(result);
    } catch (error) {
      logger.error('GET /workflows error', { error });
      res.status(500).json({ error: 'Failed to list workflows' });
    }
  },
);

/** POST /workflows – create a workflow */
workflowRouter.post(
  '/',
  validateBody(createWorkflowSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as {
        name: string;
        description?: string;
        definition: Record<string, unknown>;
        status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      };
      const workflow = await workflowRepository.create(req.tenantId, {
        name: body.name,
        description: body.description,
        definition: body.definition,
        status: body.status,
      });
      res.status(201).json(workflow);
    } catch (error) {
      logger.error('POST /workflows error', { error });
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  },
);

/** GET /workflows/:id – get a workflow by ID */
workflowRouter.get(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const workflow = await workflowRepository.findById(req.tenantId, req.params['id'] as string);
      if (!workflow) { res.status(404).json({ error: 'Workflow not found' }); return; }
      res.json(workflow);
    } catch (error) {
      logger.error('GET /workflows/:id error', { error });
      res.status(500).json({ error: 'Failed to get workflow' });
    }
  },
);

/** PATCH /workflows/:id – update a workflow */
workflowRouter.patch(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const workflow = await workflowRepository.update(
        req.tenantId,
        req.params['id'] as string,
        req.body as Prisma.WorkflowUpdateInput,
      );
      res.json(workflow);
    } catch (error) {
      logger.error('PATCH /workflows/:id error', { error });
      res.status(500).json({ error: 'Failed to update workflow' });
    }
  },
);

/** DELETE /workflows/:id – delete a workflow */
workflowRouter.delete(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await workflowRepository.delete(req.tenantId, req.params['id'] as string);
      res.status(204).send();
    } catch (error) {
      logger.error('DELETE /workflows/:id error', { error });
      res.status(500).json({ error: 'Failed to delete workflow' });
    }
  },
);
