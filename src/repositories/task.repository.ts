/**
 * Task repository for @ascendstack/vectordb.
 * Manages task records representing individual steps within an execution.
 */

import { Prisma, Task } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';

type TaskCreateInput = Omit<Prisma.TaskUncheckedCreateInput, 'tenant_id'>;
type TaskUpdateInput = Prisma.TaskUncheckedUpdateInput;

/** Repository for Task data access. */
export class TaskRepository extends BaseRepository<Task, TaskCreateInput, TaskUpdateInput> {
  /** Creates a task within an execution. */
  async create(tenantId: string, data: TaskCreateInput): Promise<Task> {
    return prisma.task.create({
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Finds a task by ID within the tenant scope. */
  async findById(tenantId: string, id: string): Promise<Task | null> {
    return prisma.task.findFirst({ where: { id, tenant_id: tenantId } });
  }

  /** Lists tasks for a tenant with pagination. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<Task>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.task.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.task.count({ where: { tenant_id: tenantId } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates a task record. */
  async update(tenantId: string, id: string, data: TaskUpdateInput): Promise<Task> {
    await prisma.task.updateMany({
      where: { id, tenant_id: tenantId },
      data: { ...data, tenant_id: tenantId },
    });
    const updated = await prisma.task.findFirst({ where: { id, tenant_id: tenantId } });
    if (!updated) throw new Error('Task not found');
    return updated;
  }

  /** Deletes a task record. */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.task.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /** Returns all tasks for a given execution, ordered by creation time. */
  async findByExecutionId(tenantId: string, executionId: string): Promise<Task[]> {
    return prisma.task.findMany({
      where: { tenant_id: tenantId, execution_id: executionId },
      orderBy: { created_at: 'asc' },
    });
  }

  /** Bulk-creates multiple tasks within a transaction. */
  async bulkCreate(tenantId: string, tasks: TaskCreateInput[]): Promise<number> {
    const result = await prisma.task.createMany({
      data: tasks.map((t) => ({ ...t, tenant_id: tenantId })),
      skipDuplicates: true,
    });
    return result.count;
  }
}

export const taskRepository = new TaskRepository();
