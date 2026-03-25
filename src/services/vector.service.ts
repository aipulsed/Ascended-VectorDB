/**
 * Vector service for @ascendstack/vectordb.
 * Coordinates embedding insertion, similarity search, hybrid search,
 * and document re-indexing operations across the embedding pipeline.
 */

import { Embedding } from '@prisma/client';
import { embeddingRepository } from '../repositories/embedding.repository';
import { documentChunkRepository } from '../repositories/document-chunk.repository';
import { documentRepository } from '../repositories/document.repository';
import { logger } from '../lib/logger';
import { SearchResult, VectorSearchParams, HybridSearchParams } from '../types';
import { config } from '../config';

export interface InsertEmbeddingInput {
  documentChunkId?: string;
  agentMemoryId?: string;
  model?: string;
  dimensions?: number;
  embedding: number[];
}

/** Service for vector embedding operations. */
export class VectorService {
  /**
   * Inserts a new embedding for a document chunk or agent memory entry.
   */
  async insertEmbedding(tenantId: string, input: InsertEmbeddingInput): Promise<Embedding> {
    if (!input.documentChunkId && !input.agentMemoryId) {
      throw new Error('Either documentChunkId or agentMemoryId must be provided');
    }
    if (input.embedding.length !== (input.dimensions ?? config.EMBEDDING_DIMENSIONS)) {
      throw new Error(
        `Embedding dimension mismatch: expected ${input.dimensions ?? config.EMBEDDING_DIMENSIONS}, got ${input.embedding.length}`,
      );
    }

    try {
      const embedding = await embeddingRepository.insertEmbedding(
        tenantId,
        {
          document_chunk_id: input.documentChunkId,
          agent_memory_id: input.agentMemoryId,
          model: input.model ?? 'text-embedding-3-small',
          dimensions: input.dimensions ?? config.EMBEDDING_DIMENSIONS,
        },
        input.embedding,
      );

      logger.info('Embedding inserted', {
        tenantId,
        embeddingId: embedding.id,
        chunkId: input.documentChunkId,
      });

      return embedding;
    } catch (error) {
      logger.error('Failed to insert embedding', { tenantId, error });
      throw error;
    }
  }

  /**
   * Performs a cosine similarity search for the most relevant document chunks.
   */
  async searchSimilar(params: VectorSearchParams): Promise<SearchResult[]> {
    try {
      return await embeddingRepository.rawVectorSearch(params);
    } catch (error) {
      logger.error('Vector search failed', { tenantId: params.tenantId, error });
      throw error;
    }
  }

  /**
   * Performs a hybrid search combining vector similarity with full-text keyword matching.
   */
  async hybridSearch(params: HybridSearchParams): Promise<SearchResult[]> {
    try {
      return await embeddingRepository.hybridSearch(params);
    } catch (error) {
      logger.error('Hybrid search failed', { tenantId: params.tenantId, error });
      throw error;
    }
  }

  /**
   * Deletes a single embedding record by ID.
   */
  async deleteEmbedding(tenantId: string, embeddingId: string): Promise<void> {
    try {
      await embeddingRepository.delete(tenantId, embeddingId);
      logger.info('Embedding deleted', { tenantId, embeddingId });
    } catch (error) {
      logger.error('Failed to delete embedding', { tenantId, embeddingId, error });
      throw error;
    }
  }

  /**
   * Re-indexes all chunks for a document by deleting existing embeddings
   * and marking chunks as needing new embeddings.
   * The caller is responsible for generating new embedding vectors.
   */
  async reindexDocument(tenantId: string, documentId: string): Promise<number> {
    try {
      const document = await documentRepository.findById(tenantId, documentId);
      if (!document) throw new Error(`Document ${documentId} not found`);

      const chunks = await documentChunkRepository.findByDocumentId(tenantId, documentId);

      let deleted = 0;
      for (const chunk of chunks) {
        const embedding = await embeddingRepository.findByChunkId(tenantId, chunk.id);
        if (embedding) {
          await embeddingRepository.delete(tenantId, embedding.id);
          deleted++;
        }
      }

      await documentRepository.update(tenantId, documentId, { status: 'PENDING' });

      logger.info('Document re-index initiated', { tenantId, documentId, deletedEmbeddings: deleted });
      return deleted;
    } catch (error) {
      logger.error('Failed to reindex document', { tenantId, documentId, error });
      throw error;
    }
  }
}

export const vectorService = new VectorService();
