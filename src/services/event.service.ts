/**
 * Event service for @ascendstack/vectordb.
 * Handles event ingestion from the Ascended-Event-Bus, execution timeline queries,
 * and event type filtering.
 */

import { Event, Prisma } from '@prisma/client';
import { eventRepository } from '../repositories/event.repository';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { EventBusMessage, PaginatedResult, PaginationParams } from '../types';

/** Service for event ingestion and querying. */
export class EventService {
  /**
   * Ingests a single domain event into the store.
   */
  async ingestEvent(
    tenantId: string,
    type: string,
    payload: Record<string, unknown>,
    options?: {
      executionId?: string;
      source?: string;
      correlationId?: string;
    },
  ): Promise<Event> {
    try {
      const event = await eventRepository.create(tenantId, {
        type,
        payload: payload as Prisma.InputJsonValue,
        execution_id: options?.executionId,
        source: options?.source,
        correlation_id: options?.correlationId,
      });

      logger.info('Event ingested', { tenantId, eventId: event.id, type });
      return event;
    } catch (error) {
      logger.error('Failed to ingest event', { tenantId, type, error });
      throw error;
    }
  }

  /**
   * Returns the chronological event timeline for a specific execution.
   */
  async getExecutionTimeline(tenantId: string, executionId: string): Promise<Event[]> {
    try {
      return await eventRepository.getTimeline(tenantId, executionId);
    } catch (error) {
      logger.error('Failed to get execution timeline', { tenantId, executionId, error });
      throw error;
    }
  }

  /**
   * Returns paginated events filtered by event type.
   */
  async getEventsByType(
    tenantId: string,
    type: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<Event>> {
    try {
      const { page, limit } = params;
      const skip = (page - 1) * limit;
      const where: Prisma.EventWhereInput = { tenant_id: tenantId, type };

      const [data, total] = await prisma.$transaction([
        prisma.event.findMany({ where, skip, take: limit, orderBy: { timestamp: 'desc' } }),
        prisma.event.count({ where }),
      ]);

      return { data, total, page, limit, hasMore: skip + limit < total };
    } catch (error) {
      logger.error('Failed to get events by type', { tenantId, type, error });
      throw error;
    }
  }

  /**
   * Processes an inbound message from the Ascended-Event-Bus and persists it as an Event.
   */
  async processEventBusMessage(message: EventBusMessage): Promise<Event> {
    try {
      const event = await eventRepository.ingestEvent(message);
      logger.info('Event bus message processed', {
        tenantId: message.tenantId,
        type: message.type,
        eventId: event.id,
      });
      return event;
    } catch (error) {
      logger.error('Failed to process event bus message', { message, error });
      throw error;
    }
  }
}

export const eventService = new EventService();
