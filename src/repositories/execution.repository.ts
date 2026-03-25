/**
 * Execution repository for @ascendstack/vectordb.
 * Manages workflow execution records with support for status filtering,
 * workflow association, and eager loading of related tasks.
 */

import { Execution, ExecutionStatus, Prisma, Task } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';

type ExecutionCreateInput = Omit<Prisma.ExecutionUncheckedCreateInput, 'tenant_id'>;
type ExecutionUpdateInput = Prisma.ExecutionUncheckedUpdateInput;

export type ExecutionWithTasks = Execution & { tasks: Task[] };

/** Repository for Execution data access. */
export class ExecutionRepository extends BaseRepository<Execution, ExecutionCreateInput, ExecutionUpdateInput> {
  /** Creates a new execution record. */
  async create(tenantId: string, data: ExecutionCreateInput): Promise<Execution> {
    return prisma.execution.create({
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Finds an execution by ID within the tenant scope. */
  async findById(tenantId: string, id: string): Promise<Execution | null> {
    return prisma.execution.findFirst({
      where: { id, tenant_id: tenantId },
    });
  }

  /** Lists executions for a tenant with pagination. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<Execution>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.execution.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.execution.count({ where: { tenant_id: tenantId } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates an execution record. */
  async update(tenantId: string, id: string, data: ExecutionUpdateInput): Promise<Execution> {
    await prisma.execution.updateMany({
      where: { id, tenant_id: tenantId },
      data: { ...data, tenant_id: tenantId },
    });
    const updated = await prisma.execution.findFirst({ where: { id, tenant_id: tenantId } });
    if (!updated) throw new Error('Execution not found');
    return updated;
  }

  /** Deletes an execution record. */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.execution.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /** Returns executions associated with a specific workflow. */
  async findByWorkflowId(tenantId: string, workflowId: string): Promise<Execution[]> {
    return prisma.execution.findMany({
      where: { tenant_id: tenantId, workflow_id: workflowId },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Returns executions filtered by status. */
  async findByStatus(tenantId: string, status: ExecutionStatus): Promise<Execution[]> {
    return prisma.execution.findMany({
      where: { tenant_id: tenantId, status },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Returns an execution with all associated tasks eagerly loaded. */
  async getWithTasks(tenantId: string, id: string): Promise<ExecutionWithTasks | null> {
    return prisma.execution.findFirst({
      where: { id, tenant_id: tenantId },
      include: { tasks: { orderBy: { created_at: 'asc' } } },
    });
  }
}

export const executionRepository = new ExecutionRepository();
