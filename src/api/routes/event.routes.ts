/**
 * Event routes for @ascendstack/vectordb.
 * Handles domain event ingestion and retrieval.
 */

import { Router, Request, Response } from 'express';
import { eventService } from '../../services/event.service';
import { eventRepository } from '../../repositories/event.repository';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware';
import { createEventSchema, idParamSchema, paginationSchema } from '../../utils/validation';
import { logger } from '../../lib/logger';
import { z } from 'zod';

export const eventRouter = Router();

const executionIdParamSchema = z.object({ executionId: z.string().uuid() });

/** POST /events – ingest an event */
eventRouter.post(
  '/',
  validateBody(createEventSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as {
        type: string;
        payload: Record<string, unknown>;
        executionId?: string;
        source?: string;
        correlationId?: string;
      };
      const event = await eventService.ingestEvent(req.tenantId, body.type, body.payload, {
        executionId: body.executionId,
        source: body.source,
        correlationId: body.correlationId,
      });
      res.status(201).json(event);
    } catch (error) {
      logger.error('POST /events error', { error });
      res.status(500).json({ error: 'Failed to ingest event' });
    }
  },
);

/** GET /events – list events */
eventRouter.get(
  '/',
  validateQuery(paginationSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit } = req.query as { page: string; limit: string };
      const result = await eventRepository.list(req.tenantId, {
        page: Number(page),
        limit: Number(limit),
      });
      res.json(result);
    } catch (error) {
      logger.error('GET /events error', { error });
      res.status(500).json({ error: 'Failed to list events' });
    }
  },
);

/** GET /events/:id – get event by ID */
eventRouter.get(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const event = await eventRepository.findById(req.tenantId, req.params['id'] as string);
      if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
      res.json(event);
    } catch (error) {
      logger.error('GET /events/:id error', { error });
      res.status(500).json({ error: 'Failed to get event' });
    }
  },
);

/** GET /executions/:executionId/events – get events for an execution */
eventRouter.get(
  '/executions/:executionId/events',
  validateParams(executionIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const events = await eventRepository.findByExecutionId(
        req.tenantId,
        req.params['executionId'] as string,
      );
      res.json(events);
    } catch (error) {
      logger.error('GET /executions/:executionId/events error', { error });
      res.status(500).json({ error: 'Failed to get execution events' });
    }
  },
);
