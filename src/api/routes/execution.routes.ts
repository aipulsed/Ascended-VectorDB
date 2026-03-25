/**
 * Execution routes for @ascendstack/vectordb.
 * Manages workflow execution lifecycle via REST endpoints.
 */

import { Router, Request, Response } from 'express';
import { executionService } from '../../services/execution.service';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware';
import {
  createExecutionSchema,
  updateExecutionStatusSchema,
  idParamSchema,
  paginationSchema,
} from '../../utils/validation';
import { executionRepository } from '../../repositories/execution.repository';
import { logger } from '../../lib/logger';
import { z } from 'zod';
import { ExecutionStatus } from '@prisma/client';

export const executionRouter = Router();

const replaySchema = z.object({ fromStep: z.string().min(1) });

/** POST /executions – create a new execution */
executionRouter.post(
  '/',
  validateBody(createExecutionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const execution = await executionService.createExecution(req.tenantId, req.body as {
        workflowId?: string;
        input?: Record<string, unknown>;
        maxRetries?: number;
      });
      res.status(201).json(execution);
    } catch (error) {
      logger.error('POST /executions error', { error });
      res.status(500).json({ error: 'Failed to create execution' });
    }
  },
);

/** GET /executions – list executions */
executionRouter.get(
  '/',
  validateQuery(paginationSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit } = req.query as { page: string; limit: string };
      const result = await executionRepository.list(req.tenantId, {
        page: Number(page),
        limit: Number(limit),
      });
      res.json(result);
    } catch (error) {
      logger.error('GET /executions error', { error });
      res.status(500).json({ error: 'Failed to list executions' });
    }
  },
);

/** GET /executions/:id – get execution by ID */
executionRouter.get(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const execution = await executionRepository.findById(req.tenantId, req.params['id'] as string);
      if (!execution) { res.status(404).json({ error: 'Execution not found' }); return; }
      res.json(execution);
    } catch (error) {
      logger.error('GET /executions/:id error', { error });
      res.status(500).json({ error: 'Failed to get execution' });
    }
  },
);

/** PATCH /executions/:id/status – update execution status */
executionRouter.patch(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(updateExecutionStatusSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.body as { status: ExecutionStatus };
      const execution = await executionService.updateStatus(
        req.tenantId,
        req.params['id'] as string,
        status,
      );
      res.json(execution);
    } catch (error) {
      logger.error('PATCH /executions/:id/status error', { error });
      res.status(500).json({ error: 'Failed to update execution status' });
    }
  },
);

/** POST /executions/:id/replay – replay from step */
executionRouter.post(
  '/:id/replay',
  validateParams(idParamSchema),
  validateBody(replaySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { fromStep } = req.body as { fromStep: string };
      const execution = await executionService.replayFromStep(
        req.tenantId,
        req.params['id'] as string,
        fromStep,
      );
      res.json(execution);
    } catch (error) {
      logger.error('POST /executions/:id/replay error', { error });
      res.status(500).json({ error: 'Failed to replay execution' });
    }
  },
);

/** GET /executions/:id/timeline – get execution timeline */
executionRouter.get(
  '/:id/timeline',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const timeline = await executionService.getExecutionTimeline(
        req.tenantId,
        req.params['id'] as string,
      );
      res.json(timeline);
    } catch (error) {
      logger.error('GET /executions/:id/timeline error', { error });
      res.status(500).json({ error: 'Failed to get execution timeline' });
    }
  },
);
