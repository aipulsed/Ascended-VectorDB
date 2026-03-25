/**
 * Document routes for @ascendstack/vectordb.
 * Handles document ingestion and management.
 */

import { Router, Request, Response } from 'express';
import { documentService } from '../../services/document.service';
import { validateBody, validateParams } from '../../middleware/validation.middleware';
import { ingestDocumentSchema, idParamSchema } from '../../utils/validation';
import { logger } from '../../lib/logger';

export const documentRouter = Router();

/** POST /documents – ingest a document */
documentRouter.post(
  '/',
  validateBody(ingestDocumentSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await documentService.ingestDocument(req.tenantId, req.body as {
        filename: string;
        contentType: string;
        content: string;
        sizeBytes?: number;
        storageUrl?: string;
        metadata?: Record<string, unknown>;
        chunkSize?: number;
        chunkOverlap?: number;
      });
      res.status(201).json(result);
    } catch (error) {
      logger.error('POST /documents error', { error });
      res.status(500).json({ error: 'Failed to ingest document' });
    }
  },
);

/** GET /documents/:id – get document by ID */
documentRouter.get(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const document = await documentService.getDocumentStatus(
        req.tenantId,
        req.params['id'] as string,
      );
      res.json(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document not found';
      res.status(404).json({ error: message });
    }
  },
);

/** GET /documents/:id/status – get document processing status */
documentRouter.get(
  '/:id/status',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const document = await documentService.getDocumentStatus(
        req.tenantId,
        req.params['id'] as string,
      );
      res.json({ id: document.id, status: document.status, filename: document.filename });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document not found';
      res.status(404).json({ error: message });
    }
  },
);

/** DELETE /documents/:id – soft-delete a document */
documentRouter.delete(
  '/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await documentService.deleteDocument(req.tenantId, req.params['id'] as string);
      res.status(204).send();
    } catch (error) {
      logger.error('DELETE /documents/:id error', { error });
      res.status(500).json({ error: 'Failed to delete document' });
    }
  },
);
