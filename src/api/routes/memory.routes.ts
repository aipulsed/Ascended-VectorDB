/**
 * Agent memory routes for @ascendstack/vectordb.
 * Provides key/value memory storage and semantic recall for AI agents.
 */

import { Router, Request, Response } from 'express';
import { agentMemoryService } from '../../services/agent-memory.service';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { storeMemorySchema, recallMemorySchema } from '../../utils/validation';
import { logger } from '../../lib/logger';
import { z } from 'zod';

export const memoryRouter = Router();

const agentKeyParamSchema = z.object({
  agentId: z.string().min(1),
  key: z.string().min(1),
});

const agentIdParamSchema = z.object({ agentId: z.string().min(1) });

/** POST /memory – store a memory entry */
memoryRouter.post(
  '/',
  validateBody(storeMemorySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const memory = await agentMemoryService.storeMemory(req.tenantId, req.body as {
        agentId: string;
        key: string;
        value: string;
        memoryType?: 'SHORT_TERM' | 'LONG_TERM';
        ttlSeconds?: number;
        metadata?: Record<string, unknown>;
      });
      res.status(201).json(memory);
    } catch (error) {
      logger.error('POST /memory error', { error });
      res.status(500).json({ error: 'Failed to store memory' });
    }
  },
);

/** GET /memory/:agentId – recall all memories for an agent */
memoryRouter.get(
  '/:agentId',
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const memories = await agentMemoryService.recallMemory(
        req.tenantId,
        req.params['agentId'] as string,
      );
      res.json(memories);
    } catch (error) {
      logger.error('GET /memory/:agentId error', { error });
      res.status(500).json({ error: 'Failed to recall memories' });
    }
  },
);

/** POST /memory/recall – semantic recall via vector search */
memoryRouter.post(
  '/recall',
  validateBody(recallMemorySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as { agentId: string; embedding: number[]; topK?: number };
      const results = await agentMemoryService.recallSemantic(req.tenantId, body.agentId, {
        tenantId: req.tenantId,
        embedding: body.embedding,
        topK: body.topK,
      });
      res.json({ results, count: results.length });
    } catch (error) {
      logger.error('POST /memory/recall error', { error });
      res.status(500).json({ error: 'Semantic recall failed' });
    }
  },
);

/** DELETE /memory/:agentId/:key – forget a specific memory */
memoryRouter.delete(
  '/:agentId/:key',
  validateParams(agentKeyParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await agentMemoryService.forgetMemory(
        req.tenantId,
        req.params['agentId'] as string,
        req.params['key'] as string,
      );
      res.status(204).send();
    } catch (error) {
      logger.error('DELETE /memory/:agentId/:key error', { error });
      res.status(500).json({ error: 'Failed to forget memory' });
    }
  },
);
