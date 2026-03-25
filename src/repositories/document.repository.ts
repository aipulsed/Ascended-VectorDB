/**
 * Document repository for @ascendstack/vectordb.
 * Manages document records with soft-delete support and status-based filtering
 * for the document ingestion pipeline.
 */

import { Document, DocumentStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';

type DocumentCreateInput = Omit<Prisma.DocumentUncheckedCreateInput, 'tenant_id'>;
type DocumentUpdateInput = Prisma.DocumentUncheckedUpdateInput;

/** Repository for Document data access. */
export class DocumentRepository extends BaseRepository<Document, DocumentCreateInput, DocumentUpdateInput> {
  /** Creates a new document record. */
  async create(tenantId: string, data: DocumentCreateInput): Promise<Document> {
    return prisma.document.create({
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Finds a document by ID, excluding soft-deleted records. */
  async findById(tenantId: string, id: string): Promise<Document | null> {
    return prisma.document.findFirst({
      where: { id, tenant_id: tenantId, deleted_at: null },
    });
  }

  /** Lists active (non-deleted) documents for a tenant with pagination. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<Document>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.document.findMany({
        where: { tenant_id: tenantId, deleted_at: null },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.document.count({ where: { tenant_id: tenantId, deleted_at: null } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates a document record. */
  async update(tenantId: string, id: string, data: DocumentUpdateInput): Promise<Document> {
    await prisma.document.updateMany({
      where: { id, tenant_id: tenantId },
      data: { ...data, tenant_id: tenantId },
    });
    const updated = await prisma.document.findFirst({ where: { id, tenant_id: tenantId, deleted_at: null } });
    if (!updated) throw new Error('Document not found');
    return updated;
  }

  /** Hard-deletes a document record (prefer softDelete for user-facing operations). */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.document.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /** Soft-deletes a document by setting deleted_at timestamp. */
  async softDelete(tenantId: string, id: string): Promise<Document> {
    await prisma.document.updateMany({
      where: { id, tenant_id: tenantId },
      data: { tenant_id: tenantId, deleted_at: new Date() },
    });
    const updated = await prisma.document.findFirst({ where: { id, tenant_id: tenantId } });
    if (!updated) throw new Error('Document not found');
    return updated;
  }

  /** Returns documents filtered by processing status. */
  async findByStatus(tenantId: string, status: DocumentStatus): Promise<Document[]> {
    return prisma.document.findMany({
      where: { tenant_id: tenantId, status, deleted_at: null },
      orderBy: { created_at: 'asc' },
    });
  }
}

export const documentRepository = new DocumentRepository();
