/**
 * Prisma client singleton for @ascendstack/vectordb.
 * Applies middleware for:
 *   - tenant_id validation on all mutations
 *   - slow query logging (>500 ms threshold)
 * Always import this module instead of instantiating PrismaClient directly.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from './logger';

const SLOW_QUERY_THRESHOLD_MS = 500;

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  // Log errors from Prisma
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('error', (e: { message: string; target: string }) => {
    logger.error('Prisma error', { message: e.message, target: e.target });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on('warn', (e: { message: string; target: string }) => {
    logger.warn('Prisma warning', { message: e.message, target: e.target });
  });

  // Slow query middleware
  client.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    const start = Date.now();
    const result: unknown = await next(params);
    const duration = Date.now() - start;

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn('Slow Prisma query detected', {
        model: params.model,
        action: params.action,
        duration_ms: duration,
      });
    }

    return result;
  });

  // Tenant isolation middleware – ensures tenant_id is present on writes
  client.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    const writeMutations = ['create', 'createMany', 'update', 'updateMany', 'upsert'];
    const modelsRequiringTenant = [
      'Workflow',
      'Execution',
      'Task',
      'Event',
      'Document',
      'DocumentChunk',
      'Embedding',
      'AgentMemory',
      'ApiKey',
    ];

    if (
      params.model &&
      modelsRequiringTenant.includes(params.model) &&
      writeMutations.includes(params.action)
    ) {
      const data = (params.args as { data?: Record<string, unknown> })?.data;
      if (data && !data['tenant_id']) {
        throw new Error(
          `tenant_id is required for ${params.model}.${params.action}`,
        );
      }
    }

    return next(params);
  });

  return client;
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/** Shared Prisma client instance (singleton). */
export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}
