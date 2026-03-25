/**
 * Vector search routes for @ascendstack/vectordb.
 * Provides cosine similarity and hybrid search endpoints,
 * plus embedding CRUD operations.
 */

import { Router, Request, Response } from 'express';
import { vectorService } from '../../services/vector.service';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { vectorSearchSchema, hybridSearchSchema, insertEmbeddingSchema, idParamSchema } from '../../utils/validation';
import { logger } from '../../lib/logger';

export const vectorRouter = Router();

/** POST /vectors/search – cosine similarity search */
vectorRouter.post(
  '/search',
  validateBody(vectorSearchSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as {
        embedding: number[];
        topK?: number;
        filter?: Record<string, unknown>;
      };
      const results = await vectorService.searchSimilar({
        tenantId: req.tenantId,
        embedding: body.embedding,
        topK: body.topK,
        filter: body.filter,
      });
      res.json({ results, count: results.length });
    } catch (error) {
      logger.error('POST /vectors/search error', { error });
      res.status(500).json({ error: 'Vector search failed' });
    }
  },
);

/** POST /vectors/hybrid-search – hybrid vector + keyword search */
vectorRouter.post(
  '/hybrid-search',
  validateBody(hybridSearchSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as {
        embedding: number[];
        query: string;
        topK?: number;
        vectorWeight?: number;
        filter?: Record<string, unknown>;
      };
      const results = await vectorService.hybridSearch({
        tenantId: req.tenantId,
        embedding: body.embedding,
        query: body.query,
        topK: body.topK,
        vectorWeight: body.vectorWeight,
        filter: body.filter,
      });
      res.json({ results, count: results.length });
    } catch (error) {
      logger.error('POST /vectors/hybrid-search error', { error });
      res.status(500).json({ error: 'Hybrid search failed' });
    }
  },
);

/** POST /vectors/embeddings – insert an embedding */
vectorRouter.post(
  '/embeddings',
  validateBody(insertEmbeddingSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as {
        documentChunkId?: string;
        agentMemoryId?: string;
        model?: string;
        dimensions?: number;
        embedding: number[];
      };
      const embedding = await vectorService.insertEmbedding(req.tenantId, body);
      res.status(201).json(embedding);
    } catch (error) {
      logger.error('POST /vectors/embeddings error', { error });
      res.status(500).json({ error: 'Failed to insert embedding' });
    }
  },
);

/** DELETE /vectors/embeddings/:id – delete an embedding */
vectorRouter.delete(
  '/embeddings/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await vectorService.deleteEmbedding(req.tenantId, req.params['id'] as string);
      res.status(204).send();
    } catch (error) {
      logger.error('DELETE /vectors/embeddings/:id error', { error });
      res.status(500).json({ error: 'Failed to delete embedding' });
    }
  },
);
