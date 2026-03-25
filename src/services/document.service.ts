/**
 * Document service for @ascendstack/vectordb.
 * Manages the full document ingestion pipeline: intake, chunking,
 * status tracking, and soft deletion.
 */

import { Document } from '@prisma/client';
import { documentRepository } from '../repositories/document.repository';
import { documentChunkRepository } from '../repositories/document-chunk.repository';
import { logger } from '../lib/logger';
import { fixedSizeChunk } from '../utils/chunking';

export interface IngestDocumentInput {
  filename: string;
  contentType: string;
  content: string;
  sizeBytes?: number;
  storageUrl?: string;
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface ProcessedDocument {
  document: Document;
  chunkCount: number;
}

/** Service for document ingestion and lifecycle management. */
export class DocumentService {
  /**
   * Ingests a document and splits it into fixed-size text chunks.
   * The document transitions from PENDING → PROCESSING → READY.
   */
  async ingestDocument(tenantId: string, input: IngestDocumentInput): Promise<ProcessedDocument> {
    let document: Document | null = null;
    try {
      document = await documentRepository.create(tenantId, {
        filename: input.filename,
        content_type: input.contentType,
        size_bytes: input.sizeBytes,
        storage_url: input.storageUrl,
        metadata: input.metadata as object | undefined,
        status: 'PENDING',
      });

      await documentRepository.update(tenantId, document.id, { status: 'PROCESSING' });

      const chunkCount = await this.processChunks(
        tenantId,
        document.id,
        input.content,
        input.chunkSize,
        input.chunkOverlap,
      );

      await documentRepository.update(tenantId, document.id, { status: 'READY' });

      logger.info('Document ingested', { tenantId, documentId: document.id, chunkCount });
      return { document, chunkCount };
    } catch (error) {
      if (document) {
        await documentRepository.update(tenantId, document.id, {
          status: 'FAILED',
        }).catch(() => undefined);
      }
      logger.error('Document ingestion failed', { tenantId, error });
      throw error;
    }
  }

  /**
   * Splits content into chunks and persists them to the DocumentChunk table.
   * Returns the number of chunks created.
   */
  async processChunks(
    tenantId: string,
    documentId: string,
    content: string,
    chunkSize = 512,
    overlap = 64,
  ): Promise<number> {
    const chunks = fixedSizeChunk(content, chunkSize, overlap);

    const chunkData = chunks.map((text: string, index: number) => ({
      document_id: documentId,
      content: text,
      chunk_index: index,
      token_count: Math.ceil(text.length / 4), // approximate token count
    }));

    return documentChunkRepository.bulkCreate(tenantId, chunkData);
  }

  /**
   * Returns the current processing status of a document.
   */
  async getDocumentStatus(tenantId: string, documentId: string): Promise<Document> {
    const document = await documentRepository.findById(tenantId, documentId);
    if (!document) throw new Error(`Document ${documentId} not found`);
    return document;
  }

  /**
   * Soft-deletes a document, preserving chunks and embeddings for audit purposes.
   */
  async deleteDocument(tenantId: string, documentId: string): Promise<void> {
    try {
      const document = await documentRepository.findById(tenantId, documentId);
      if (!document) throw new Error(`Document ${documentId} not found`);

      await documentRepository.softDelete(tenantId, documentId);
      logger.info('Document soft-deleted', { tenantId, documentId });
    } catch (error) {
      logger.error('Failed to delete document', { tenantId, documentId, error });
      throw error;
    }
  }
}

export const documentService = new DocumentService();
