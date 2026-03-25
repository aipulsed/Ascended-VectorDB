/**
 * Unit tests for VectorService.
 * Verifies embedding insertion, similarity search, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VectorService } from '../../../src/services/vector.service';

vi.mock('../../../src/repositories/embedding.repository', () => ({
  embeddingRepository: {
    insertEmbedding: vi.fn(),
    rawVectorSearch: vi.fn(),
    hybridSearch: vi.fn(),
    delete: vi.fn(),
    findByChunkId: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/document.repository', () => ({
  documentRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/document-chunk.repository', () => ({
  documentChunkRepository: {
    findByDocumentId: vi.fn(),
  },
}));

vi.mock('../../../src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/config', () => ({
  config: {
    EMBEDDING_DIMENSIONS: 1536,
  },
}));

import { embeddingRepository } from '../../../src/repositories/embedding.repository';

const mockEmbRepo = embeddingRepository as unknown as {
  insertEmbedding: ReturnType<typeof vi.fn>;
  rawVectorSearch: ReturnType<typeof vi.fn>;
  hybridSearch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const TENANT = 'tenant-xyz';
const EMBEDDING = Array.from({ length: 1536 }, (_, i) => i / 1536);

describe('VectorService', () => {
  let service: VectorService;

  beforeEach(() => {
    service = new VectorService();
    vi.clearAllMocks();
  });

  describe('insertEmbedding', () => {
    it('inserts a valid embedding for a document chunk', async () => {
      const mockEmbedding = { id: 'emb-1', tenant_id: TENANT, document_chunk_id: 'chunk-1' };
      mockEmbRepo.insertEmbedding.mockResolvedValueOnce(mockEmbedding);

      const result = await service.insertEmbedding(TENANT, {
        documentChunkId: 'chunk-1',
        embedding: EMBEDDING,
      });

      expect(mockEmbRepo.insertEmbedding).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ document_chunk_id: 'chunk-1' }),
        EMBEDDING,
      );
      expect(result).toEqual(mockEmbedding);
    });

    it('throws when neither documentChunkId nor agentMemoryId is provided', async () => {
      await expect(
        service.insertEmbedding(TENANT, { embedding: EMBEDDING }),
      ).rejects.toThrow('Either documentChunkId or agentMemoryId must be provided');
    });

    it('throws on dimension mismatch', async () => {
      await expect(
        service.insertEmbedding(TENANT, {
          documentChunkId: 'chunk-1',
          embedding: [0.1, 0.2],
          dimensions: 1536,
        }),
      ).rejects.toThrow('Embedding dimension mismatch');
    });
  });

  describe('searchSimilar', () => {
    it('delegates to embeddingRepository.rawVectorSearch', async () => {
      const mockResults = [{ id: 'chunk-1', score: 0.95, content: 'hello world' }];
      mockEmbRepo.rawVectorSearch.mockResolvedValueOnce(mockResults);

      const results = await service.searchSimilar({
        tenantId: TENANT,
        embedding: EMBEDDING,
        topK: 5,
      });

      expect(mockEmbRepo.rawVectorSearch).toHaveBeenCalledWith({
        tenantId: TENANT,
        embedding: EMBEDDING,
        topK: 5,
      });
      expect(results).toEqual(mockResults);
    });

    it('propagates errors from the repository', async () => {
      mockEmbRepo.rawVectorSearch.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.searchSimilar({ tenantId: TENANT, embedding: EMBEDDING }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('deleteEmbedding', () => {
    it('calls repository delete with correct tenant and id', async () => {
      mockEmbRepo.delete.mockResolvedValueOnce(undefined);

      await service.deleteEmbedding(TENANT, 'emb-1');

      expect(mockEmbRepo.delete).toHaveBeenCalledWith(TENANT, 'emb-1');
    });
  });
});
