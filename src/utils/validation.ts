/**
 * Common Zod validation schemas for @ascendstack/vectordb.
 * Provides reusable validators for UUIDs, pagination, embeddings, and other
 * shared request shapes consumed across API route handlers.
 */

import { z } from 'zod';

/** Validates a UUID v4 string. */
export const uuidSchema = z.string().uuid('Must be a valid UUID');

/** Validates pagination query parameters. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Schema for ID path parameters. */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/** Schema for tenant-scoped ID path parameters. */
export const tenantIdParamSchema = z.object({
  tenantId: uuidSchema,
});

/** Validates an embedding float array. */
export const embeddingSchema = z
  .array(z.number().finite())
  .min(1, 'Embedding must not be empty')
  .max(4096, 'Embedding exceeds maximum dimensions');

/** Validates a vector search request body. */
export const vectorSearchSchema = z.object({
  embedding: embeddingSchema,
  topK: z.number().int().min(1).max(100).default(10).optional(),
  filter: z.record(z.unknown()).optional(),
});

/** Validates a hybrid search request body. */
export const hybridSearchSchema = vectorSearchSchema.extend({
  query: z.string().min(1, 'Query must not be empty'),
  vectorWeight: z.number().min(0).max(1).default(0.7).optional(),
});

/** Validates workflow creation input. */
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  definition: z.record(z.unknown()),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

/** Validates execution creation input. */
export const createExecutionSchema = z.object({
  workflowId: uuidSchema.optional(),
  input: z.record(z.unknown()).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

/** Validates execution status update. */
export const updateExecutionStatusSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED']),
});

/** Validates event ingestion. */
export const createEventSchema = z.object({
  type: z.string().min(1).max(255),
  payload: z.record(z.unknown()),
  executionId: uuidSchema.optional(),
  source: z.string().optional(),
  correlationId: z.string().optional(),
});

/** Validates document ingestion. */
export const ingestDocumentSchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1),
  content: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
  storageUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
  chunkSize: z.number().int().min(64).max(4096).optional(),
  chunkOverlap: z.number().int().min(0).max(512).optional(),
});

/** Validates memory store input. */
export const storeMemorySchema = z.object({
  agentId: z.string().min(1),
  key: z.string().min(1),
  value: z.string().min(1),
  memoryType: z.enum(['SHORT_TERM', 'LONG_TERM']).optional(),
  ttlSeconds: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Validates memory semantic recall request. */
export const recallMemorySchema = z.object({
  agentId: z.string().min(1),
  embedding: embeddingSchema,
  topK: z.number().int().min(1).max(100).optional(),
});

/** Validates embedding insertion. */
export const insertEmbeddingSchema = z.object({
  documentChunkId: uuidSchema.optional(),
  agentMemoryId: uuidSchema.optional(),
  model: z.string().optional(),
  dimensions: z.number().int().positive().optional(),
  embedding: embeddingSchema,
});

/** Validates tenant creation. */
export const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  plan: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
