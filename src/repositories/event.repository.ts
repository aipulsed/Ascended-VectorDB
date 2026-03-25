/**
 * Event repository for @ascendstack/vectordb.
 * Manages domain events emitted by workflow executions and the Ascended-Event-Bus.
 * Provides timeline queries for execution observability.
 */

import { Event, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult, EventBusMessage } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';

type EventCreateInput = Omit<Prisma.EventUncheckedCreateInput, 'tenant_id'>;
type EventUpdateInput = Prisma.EventUncheckedUpdateInput;

/** Repository for Event data access. */
export class EventRepository extends BaseRepository<Event, EventCreateInput, EventUpdateInput> {
  /** Creates a new event record. */
  async create(tenantId: string, data: EventCreateInput): Promise<Event> {
    return prisma.event.create({
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Finds an event by ID within the tenant scope. */
  async findById(tenantId: string, id: string): Promise<Event | null> {
    return prisma.event.findFirst({ where: { id, tenant_id: tenantId } });
  }

  /** Lists events for a tenant with pagination, ordered by timestamp descending. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<Event>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.event.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.event.count({ where: { tenant_id: tenantId } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates an event record. */
  async update(tenantId: string, id: string, data: EventUpdateInput): Promise<Event> {
    return prisma.event.update({
      where: { id },
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Deletes an event record. */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.event.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /** Returns all events associated with a specific execution, ordered chronologically. */
  async findByExecutionId(tenantId: string, executionId: string): Promise<Event[]> {
    return prisma.event.findMany({
      where: { tenant_id: tenantId, execution_id: executionId },
      orderBy: { timestamp: 'asc' },
    });
  }

  /** Returns events in chronological order for timeline rendering. */
  async getTimeline(tenantId: string, executionId: string): Promise<Event[]> {
    return this.findByExecutionId(tenantId, executionId);
  }

  /** Ingests an event from the Ascended-Event-Bus message format. */
  async ingestEvent(message: EventBusMessage): Promise<Event> {
    return prisma.event.create({
      data: {
        tenant_id: message.tenantId,
        type: message.type,
        payload: message.payload as Prisma.InputJsonValue,
        source: message.source,
        correlation_id: message.correlationId,
        timestamp: new Date(message.timestamp),
      },
    });
  }
}

export const eventRepository = new EventRepository();
