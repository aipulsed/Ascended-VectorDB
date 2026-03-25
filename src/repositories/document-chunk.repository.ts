/**
 * DocumentChunk repository for @ascendstack/vectordb.
 * Manages text chunk records derived from documents for the embedding pipeline.
 */

import { DocumentChunk, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';

type ChunkCreateInput = Omit<Prisma.DocumentChunkUncheckedCreateInput, 'tenant_id'>;
type ChunkUpdateInput = Prisma.DocumentChunkUncheckedUpdateInput;

/** Repository for DocumentChunk data access. */
export class DocumentChunkRepository extends BaseRepository<DocumentChunk, ChunkCreateInput, ChunkUpdateInput> {
  /** Creates a single document chunk. */
  async create(tenantId: string, data: ChunkCreateInput): Promise<DocumentChunk> {
    return prisma.documentChunk.create({
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Finds a chunk by ID within the tenant scope. */
  async findById(tenantId: string, id: string): Promise<DocumentChunk | null> {
    return prisma.documentChunk.findFirst({ where: { id, tenant_id: tenantId } });
  }

  /** Lists chunks for a tenant with pagination. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<DocumentChunk>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.documentChunk.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { chunk_index: 'asc' },
      }),
      prisma.documentChunk.count({ where: { tenant_id: tenantId } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates a document chunk. */
  async update(tenantId: string, id: string, data: ChunkUpdateInput): Promise<DocumentChunk> {
    return prisma.documentChunk.update({
      where: { id },
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Deletes a document chunk. */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.documentChunk.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /** Returns all chunks for a document, ordered by chunk_index. */
  async findByDocumentId(tenantId: string, documentId: string): Promise<DocumentChunk[]> {
    return prisma.documentChunk.findMany({
      where: { tenant_id: tenantId, document_id: documentId },
      orderBy: { chunk_index: 'asc' },
    });
  }

  /** Bulk-inserts multiple chunks in a single transaction. */
  async bulkCreate(tenantId: string, chunks: ChunkCreateInput[]): Promise<number> {
    const result = await prisma.documentChunk.createMany({
      data: chunks.map((c) => ({ ...c, tenant_id: tenantId })),
      skipDuplicates: true,
    });
    return result.count;
  }

  /** Deletes all chunks belonging to a document. */
  async deleteByDocumentId(tenantId: string, documentId: string): Promise<number> {
    const result = await prisma.documentChunk.deleteMany({
      where: { tenant_id: tenantId, document_id: documentId },
    });
    return result.count;
  }
}

export const documentChunkRepository = new DocumentChunkRepository();
