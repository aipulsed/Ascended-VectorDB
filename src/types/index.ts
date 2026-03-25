/**
 * Core TypeScript types and re-exports for @ascendstack/vectordb.
 * Provides shared interfaces consumed across repositories, services, and API layers.
 * Prisma model types are re-exported for use by ecosystem packages such as
 * @ascendstack/sdk and the Deterministic-Execution-Layer.
 */

export type {
  Workflow,
  Execution,
  Task,
  Event,
  Document,
  DocumentChunk,
  Embedding,
  AgentMemory,
  Tenant,
  ApiKey,
  WorkflowStatus,
  ExecutionStatus,
  TaskStatus,
  DocumentStatus,
  MemoryType,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Multi-tenancy
// ---------------------------------------------------------------------------

/** Context object carrying the resolved tenant identifier. */
export interface TenantContext {
  tenantId: string;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Standard pagination query parameters. */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Generic paginated response envelope. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Vector search
// ---------------------------------------------------------------------------

/** Parameters for a pure vector (cosine similarity) search. */
export interface VectorSearchParams {
  tenantId: string;
  embedding: number[];
  topK?: number;
  filter?: Record<string, unknown>;
}

/** Parameters for a hybrid (vector + keyword) search. */
export interface HybridSearchParams extends VectorSearchParams {
  query: string;
  /** Weight applied to the vector score (0–1). Keyword score weight = 1 - vectorWeight. */
  vectorWeight?: number;
}

/** A single result returned from a vector or hybrid search. */
export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
  documentId?: string;
  chunkIndex?: number;
}

// ---------------------------------------------------------------------------
// API error shape (shared with ecosystem packages)
// ---------------------------------------------------------------------------

/** Standard error response body. */
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Event bus integration
// ---------------------------------------------------------------------------

/** Inbound message from the Ascended-Event-Bus. */
export interface EventBusMessage {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  source?: string;
  correlationId?: string;
  tenantId: string;
  timestamp: string;
}
