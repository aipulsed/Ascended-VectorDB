# Architecture

Ascended-VectorDB is a purpose-built persistence and search service for the AscendStack AI platform. This document describes its internal architecture, storage model, request lifecycle, and integration points.

---

## System Overview

The service is a single-process Node.js application written in TypeScript. It exposes an HTTP REST API and persists data to PostgreSQL (primary store) and Redis (optional cache). All vector operations are handled natively by the `pgvector` PostgreSQL extension — no external vector database is required.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          HTTP Clients                                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ /api/v1
┌───────────────────────────────▼──────────────────────────────────────┐
│                     Express Application                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Middleware Stack                         │    │
│  │  express.json  →  request logger  →  authMiddleware          │    │
│  │  →  tenantMiddleware  →  validateBody/validateParams         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────┐ ┌──────────┐ ┌───────────┐ ┌────────┐ ┌──────────┐    │
│  │ health │ │ tenants  │ │workflows  │ │ exec.  │ │  events  │    │
│  │ routes │ │ routes   │ │ routes    │ │ routes │ │  routes  │    │
│  └────────┘ └──────────┘ └───────────┘ └────────┘ └──────────┘    │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────────────┐   │
│  │  doc routes  │ │ vector routes │ │    memory routes         │   │
│  └──────────────┘ └───────────────┘ └──────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Service Layer                           │    │
│  │  TenantService  VectorService  DocumentService               │    │
│  │  AgentMemoryService  ExecutionService  EventService          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Repository Layer                          │    │
│  │  BaseRepository  EmbeddingRepository  DocumentChunk…         │    │
│  │  AgentMemoryRepository  ExecutionRepository  EventRepository │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐   │
│  │       Prisma ORM           │  │   ioredis (optional)         │   │
│  └──────────────┬─────────────┘  └──────────────┬───────────────┘   │
└─────────────────┼──────────────────────────────┼───────────────────┘
                  │                              │
     ┌────────────▼──────────┐      ┌────────────▼────────┐
     │  PostgreSQL 16        │      │     Redis 7          │
     │  + pgvector           │      │  (result cache)      │
     └───────────────────────┘      └─────────────────────┘
```

---

## Hybrid Storage Model

Each entity is stored in a single PostgreSQL database. The schema leverages three PostgreSQL features together:

| Feature | Usage |
|---|---|
| **Relational tables** | Tenants, Workflows, Executions, Tasks, Events, Documents, DocumentChunks, AgentMemory, ApiKeys |
| **JSONB columns** | `definition`, `input`, `output`, `payload`, `metadata` — schema-flexible structured data |
| **`vector(1536)` columns** | `Embedding.embedding` — 1 536-dimensional float32 vectors stored natively via pgvector |

This means a single `JOIN` can combine relational filters (tenant, status, date range) with vector distance queries, avoiding a round-trip to a separate vector store.

---

## Multi-Tenancy Architecture

Every table except `Tenant` and `ApiKey` carries a `tenant_id` column. Tenant isolation is enforced at two layers:

1. **Middleware layer** — `tenantMiddleware` validates the `X-Tenant-Id` header and attaches `req.tenantId` before any route handler runs.
2. **Repository layer** — every `findById`, `list`, `create`, `update`, and `delete` call in `BaseRepository` includes `tenant_id` in the `WHERE` clause. Raw SQL for vector search also carries a `tenant_id` predicate.

No cross-tenant data access is possible through the API.

---

## Vector Search Pipeline

```
Client sends { embedding: float[], topK: 5 }
          │
          ▼
  vectorRouter.post('/search')
          │
          ▼
  VectorService.searchSimilar()
          │
          ▼
  EmbeddingRepository.rawVectorSearch()
          │  Executes raw SQL:
          │  SELECT e.id, dc.content, dc.metadata,
          │         e.embedding <=> $1::vector AS distance
          │  FROM   "Embedding" e
          │  JOIN   "DocumentChunk" dc ON dc.id = e.document_chunk_id
          │  WHERE  e.tenant_id = $2
          │  ORDER  BY distance ASC
          │  LIMIT  $3
          ▼
  PostgreSQL HNSW index scan on vector column
          │
          ▼
  Returns SearchResult[] { id, score, content, metadata, documentId, chunkIndex }
```

### Hybrid Search

Hybrid search combines two ranked lists:

1. **Vector list** — top-K by cosine similarity
2. **Keyword list** — top-K by PostgreSQL `ts_rank` full-text search on `DocumentChunk.content`

The two lists are merged using a weighted sum:

```
final_score = vectorWeight × vector_score + (1 − vectorWeight) × keyword_score
```

Default `vectorWeight` is `0.7`. Results are re-sorted by `final_score` descending.

---

## Event Bus Integration Flow

```
Ascended-Event-Bus
       │
       │  POST /api/v1/events
       │  { type, payload, executionId, source, correlationId }
       ▼
  EventService.createEvent()
       │
       ▼
  EventRepository.create()   ──▶  Event row in PostgreSQL
       │
       ▼
  Linked to Execution via execution_id FK
       │
       ▼
  GET /executions/:id/timeline
  returns ordered Task + Event history
```

---

## DEL (Deterministic Execution Layer) Integration

The Deterministic Execution Layer writes and reads execution state through the REST API:

```
DEL creates execution:   POST /executions  → ExecutionStatus: PENDING
DEL starts execution:    PATCH /executions/:id/status  → RUNNING
DEL completes a step:    POST /executions/:id/tasks  → TaskStatus: COMPLETED
DEL completes:           PATCH /executions/:id/status  → COMPLETED
DEL replays from step:   POST /executions/:id/replay { fromStep }
```

Replay resets the execution to `PENDING`, clears task results from the given step onward, and allows the DEL to re-run deterministically.

---

## Agent Memory System

```
AgentMemory table
  ├── tenant_id       (isolation)
  ├── agent_id        (per-agent namespace)
  ├── key / value     (k/v store)
  ├── memory_type     (SHORT_TERM | LONG_TERM)
  ├── expires_at      (TTL, nullable)
  └── Embedding       (optional vector for semantic recall)

Short-term recall:  GET /memory/:agentId              → all non-expired entries
Semantic recall:    POST /memory/recall { embedding }  → cosine search over embeddings
Prune expired:      agentMemoryService.pruneExpiredMemories(tenantId)
```

---

## Document Ingestion Pipeline

```
POST /documents { filename, contentType, content, chunkSize?, chunkOverlap? }
     │
     ├── documentRepository.create()         status: PENDING
     ├── documentRepository.update()         status: PROCESSING
     ├── fixedSizeChunk(content, 512, 64)     → string[]
     ├── documentChunkRepository.bulkCreate() → DocumentChunk rows
     └── documentRepository.update()         status: READY

Later (caller responsibility):
     ├── Generate embedding vectors (OpenAI, etc.)
     └── POST /vectors/embeddings { documentChunkId, embedding }
```

---

## Caching Architecture

Redis caching is optional. When `REDIS_URL` is set, the `cache` utility wraps expensive reads:

- **Key pattern:** `vectordb:{tenantId}:{resource}:{id}`
- **TTL:** `CACHE_TTL_SECONDS` (default 300 s)
- **Invalidation:** writes and deletes call `cache.del()` for affected keys

If Redis is not configured, `getRedisClient()` returns `null` and the cache layer is a no-op.

---

## Security Model

| Mechanism | Details |
|---|---|
| **API key auth** | SHA-256 hash of raw key compared to `ApiKey.key_hash`; scopes and `expires_at` checked |
| **Tenant isolation** | `X-Tenant-Id` header validated against live `Tenant` record; `tenant_id` predicate on every query |
| **Input validation** | Zod schemas enforced before route handler execution; unknown fields stripped |
| **Rate limiting** | Health probe endpoints: 30 req/min per IP via `express-rate-limit` |
| **Request size limit** | `express.json({ limit: '10mb' })` |
| **Soft delete** | Documents use `deleted_at` column; data never permanently removed through normal API |

---

## Performance Characteristics

| Operation | Typical latency | Notes |
|---|---|---|
| Vector search (top-10) | 5–20 ms | HNSW index on `Embedding.embedding` |
| Hybrid search (top-10) | 10–40 ms | Vector + `ts_rank`, merged in application |
| Document ingest (10 KB) | 30–80 ms | Chunking + bulk insert of ~20 chunks |
| Execution CRUD | 2–10 ms | Standard indexed relational queries |
| Memory recall (all) | 2–8 ms | Index on `(tenant_id, agent_id)` |
