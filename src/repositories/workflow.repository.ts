/**
 * Workflow repository for @ascendstack/vectordb.
 * Provides CRUD operations for Workflow records with full tenant isolation.
 */

import { Prisma, Workflow, WorkflowStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';

type WorkflowCreateInput = Omit<Prisma.WorkflowCreateInput, 'tenant_id'> & { tenant_id?: string };
type WorkflowUpdateInput = Prisma.WorkflowUpdateInput;

/** Repository for Workflow data access. */
export class WorkflowRepository extends BaseRepository<Workflow, WorkflowCreateInput, WorkflowUpdateInput> {
  /** Creates a new workflow for the given tenant. */
  async create(tenantId: string, data: WorkflowCreateInput): Promise<Workflow> {
    return prisma.workflow.create({
      data: {
        ...data,
        tenant_id: tenantId,
      },
    });
  }

  /** Finds a workflow by ID within the tenant scope. */
  async findById(tenantId: string, id: string): Promise<Workflow | null> {
    return prisma.workflow.findFirst({
      where: { id, tenant_id: tenantId },
    });
  }

  /** Lists workflows for a tenant with pagination. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<Workflow>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.workflow.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.workflow.count({ where: { tenant_id: tenantId } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates a workflow by ID for the given tenant. */
  async update(tenantId: string, id: string, data: WorkflowUpdateInput): Promise<Workflow> {
    await prisma.workflow.updateMany({
      where: { id, tenant_id: tenantId },
      data: { ...data, tenant_id: tenantId },
    });
    const updated = await prisma.workflow.findFirst({ where: { id, tenant_id: tenantId } });
    if (!updated) throw new Error('Workflow not found');
    return updated;
  }

  /** Deletes a workflow by ID for the given tenant. */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.workflow.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /** Finds workflows by status for a tenant. */
  async findByStatus(tenantId: string, status: WorkflowStatus): Promise<Workflow[]> {
    return prisma.workflow.findMany({
      where: { tenant_id: tenantId, status },
      orderBy: { created_at: 'desc' },
    });
  }
}

/** Shared singleton instance. */
export const workflowRepository = new WorkflowRepository();
