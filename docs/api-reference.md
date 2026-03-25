# API Reference

Base URL: `http://your-host:3000/api/v1`

## Authentication

All tenant-scoped endpoints require two headers:

| Header | Description |
|---|---|
| `X-Tenant-Id` | UUID of the tenant making the request |
| `Authorization` | `Bearer <api-key>` — raw API key generated at tenant setup |

The API key is SHA-256 hashed before storage. The raw key is shown once at creation and never stored.

---

## Standard Error Responses

| Status | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `401` | Missing or invalid API key |
| `403` | Tenant not found or inactive |
| `404` | Resource not found |
| `422` | Unprocessable entity (schema mismatch) |
| `500` | Internal server error |
| `503` | Dependency unavailable (DB/Redis health check) |

```json
{ "error": "Human-readable message", "code": "OPTIONAL_CODE", "details": {} }
```

---

## Pagination

Paginated endpoints accept `?page=1&limit=20` query parameters and return:

```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

## Rate Limiting

Health probe endpoints (`/health/db`, `/health/redis`) are limited to **30 requests/minute per IP**. Application endpoints inherit platform-level rate limits.

---

## Health

### `GET /health`

Basic liveness probe — no auth required.

**Response**
```json
{ "status": "ok", "timestamp": "2024-01-15T12:00:00.000Z" }
```

```bash
curl https://api.example.com/api/v1/health
```

---

### `GET /health/db`

PostgreSQL connectivity check.

**Response `200`**
```json
{ "status": "ok", "database": "connected" }
```

**Response `503`**
```json
{ "status": "error", "database": "disconnected" }
```

```bash
curl https://api.example.com/api/v1/health/db
```

---

### `GET /health/redis`

Redis connectivity check.

**Response `200`**
```json
{ "status": "ok", "redis": "connected" }
```

**Response `200` (Redis not configured)**
```json
{ "status": "ok", "redis": "not configured" }
```

```bash
curl https://api.example.com/api/v1/health/redis
```

---

## Tenants

### `POST /tenants`

Provision a new tenant. Does **not** require auth headers.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Display name |
| `slug` | string | ✅ | Unique URL-safe identifier |
| `plan` | string | ❌ | `free` (default), `pro`, `enterprise` |
| `metadata` | object | ❌ | Arbitrary JSON metadata |

```bash
curl -X POST https://api.example.com/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "slug": "acme", "plan": "pro"}'
```

**Response `201`**
```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "slug": "acme",
  "plan": "pro",
  "isActive": true,
  "metadata": null,
  "created_at": "2024-01-15T12:00:00.000Z",
  "updated_at": "2024-01-15T12:00:00.000Z"
}
```

---

### `GET /tenants/:id`

Retrieve a tenant by ID.

```bash
curl https://api.example.com/api/v1/tenants/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `200`** — same shape as POST response.

---

## Workflows

All workflow endpoints require `X-Tenant-Id` + `Authorization` headers.

### `POST /workflows`

Create a workflow definition.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Workflow name |
| `description` | string | ❌ | Optional description |
| `definition` | object | ✅ | JSON workflow definition (arbitrary structure) |
| `status` | string | ❌ | `DRAFT` (default), `ACTIVE`, `ARCHIVED` |

```bash
curl -X POST https://api.example.com/api/v1/workflows \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"My Workflow","definition":{"steps":[]}}'
```

**Response `201`**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "My Workflow",
  "description": null,
  "definition": {"steps": []},
  "status": "DRAFT",
  "version": 1,
  "created_at": "...",
  "updated_at": "..."
}
```

---

### `GET /workflows`

List workflows for the tenant. Supports `?page=1&limit=20`.

```bash
curl "https://api.example.com/api/v1/workflows?page=1&limit=10" \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `200`** — paginated result wrapping workflow objects.

---

### `GET /workflows/:id`

Get a workflow by ID.

```bash
curl https://api.example.com/api/v1/workflows/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `200`** — single workflow object. **`404`** if not found.

---

### `PUT /workflows/:id` / `PATCH /workflows/:id`

Update a workflow. Send only the fields you want to change.

```bash
curl -X PATCH https://api.example.com/api/v1/workflows/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}'
```

**Response `200`** — updated workflow object.

---

### `DELETE /workflows/:id`

Delete a workflow.

```bash
curl -X DELETE https://api.example.com/api/v1/workflows/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `204`** — no body.

---

## Executions

### `POST /executions`

Create a new execution (optionally linked to a workflow).

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `workflowId` | string (UUID) | ❌ | Link to an existing workflow |
| `input` | object | ❌ | Execution input payload |
| `maxRetries` | number | ❌ | Max retry attempts (default `3`) |

```bash
curl -X POST https://api.example.com/api/v1/executions \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"uuid","input":{"userId":"123"}}'
```

**Response `201`** — execution object in `PENDING` status.

---

### `GET /executions`

List executions. Supports `?page=1&limit=20`.

```bash
curl "https://api.example.com/api/v1/executions?page=1&limit=20" \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `200`** — paginated result.

---

### `GET /executions/:id`

Get a single execution.

```bash
curl https://api.example.com/api/v1/executions/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

---

### `PATCH /executions/:id/status`

Update execution status.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | string | ✅ | One of: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `PAUSED` |

```bash
curl -X PATCH https://api.example.com/api/v1/executions/uuid/status \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"status":"RUNNING"}'
```

**Response `200`** — updated execution object.

---

### `POST /executions/:id/replay`

Replay an execution from a named step. Resets all tasks from that step onward to `PENDING` and transitions the execution back to `RUNNING`.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `fromStep` | string | ✅ | The `step_name` to replay from |

```bash
curl -X POST https://api.example.com/api/v1/executions/uuid/replay \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"fromStep":"validate_input"}'
```

**Response `200`** — updated execution object.

---

### `GET /executions/:id/timeline`

Get the complete execution timeline: execution metadata + ordered tasks + ordered events.

```bash
curl https://api.example.com/api/v1/executions/uuid/timeline \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `200`**
```json
{
  "execution": { "id": "uuid", "status": "COMPLETED", "..." : "..." },
  "tasks": [{ "id": "uuid", "step_name": "step1", "status": "COMPLETED" }],
  "events": [{ "id": "uuid", "type": "execution.created", "timestamp": "..." }]
}
```

---

## Events

### `POST /events`

Ingest a domain event.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | Event type (e.g. `user.signed_up`) |
| `payload` | object | ✅ | Arbitrary JSON payload |
| `executionId` | string (UUID) | ❌ | Link to an execution |
| `source` | string | ❌ | Originating service name |
| `correlationId` | string | ❌ | Correlation ID for tracing |

```bash
curl -X POST https://api.example.com/api/v1/events \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"type":"user.action","payload":{"action":"login"},"source":"auth-service"}'
```

**Response `201`** — created event object.

---

### `GET /events`

List events for the tenant. Supports `?page=1&limit=20`.

```bash
curl "https://api.example.com/api/v1/events?page=1&limit=20" \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

---

### `GET /events/:id`

Get a single event.

```bash
curl https://api.example.com/api/v1/events/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

---

## Documents

### `POST /documents`

Ingest a document and split it into chunks for embedding.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `filename` | string | ✅ | Original filename |
| `contentType` | string | ✅ | MIME type (e.g. `text/plain`) |
| `content` | string | ✅ | Full text content |
| `sizeBytes` | number | ❌ | File size in bytes |
| `storageUrl` | string | ❌ | External storage URL |
| `metadata` | object | ❌ | Arbitrary metadata |
| `chunkSize` | number | ❌ | Characters per chunk (default `1000`) |
| `chunkOverlap` | number | ❌ | Overlap between chunks (default `200`) |

```bash
curl -X POST https://api.example.com/api/v1/documents \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"filename":"guide.txt","contentType":"text/plain","content":"Full document text here..."}'
```

**Response `201`**
```json
{
  "document": { "id": "uuid", "status": "PROCESSING", "filename": "guide.txt" },
  "chunks": [{ "id": "uuid", "content": "...", "chunk_index": 0 }]
}
```

---

### `GET /documents/:id`

Get document by ID, including processing status.

```bash
curl https://api.example.com/api/v1/documents/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

---

### `DELETE /documents/:id`

Soft-delete a document (sets `deleted_at`).

```bash
curl -X DELETE https://api.example.com/api/v1/documents/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `204`** — no body.

---

### `GET /documents/:id/chunks`

Get all chunks for a document.

```bash
curl https://api.example.com/api/v1/documents/uuid/chunks \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `200`** — array of `DocumentChunk` objects.

---

## Vectors

### `POST /vectors/search`

Cosine similarity vector search over document chunk embeddings.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `embedding` | number[] | ✅ | 1536-dim float32 vector |
| `topK` | number | ❌ | Max results to return (default `10`) |
| `filter` | object | ❌ | Metadata filter (reserved for future use) |

```bash
curl -X POST https://api.example.com/api/v1/vectors/search \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"embedding":[0.1, 0.2, ...],"topK":5}'
```

**Response `200`**
```json
{
  "results": [
    {
      "id": "chunk-uuid",
      "score": 0.94,
      "content": "Matching text...",
      "metadata": {},
      "documentId": "doc-uuid",
      "chunkIndex": 3
    }
  ],
  "count": 5
}
```

---

### `POST /vectors/hybrid-search`

Hybrid search blending cosine similarity with PostgreSQL full-text search.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `embedding` | number[] | ✅ | 1536-dim float32 vector |
| `query` | string | ✅ | Keyword query string |
| `topK` | number | ❌ | Max results (default `10`) |
| `vectorWeight` | number | ❌ | Weight for vector score 0–1 (default `0.7`) |
| `filter` | object | ❌ | Metadata filter |

```bash
curl -X POST https://api.example.com/api/v1/vectors/hybrid-search \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"embedding":[0.1,...],"query":"database setup","topK":5,"vectorWeight":0.7}'
```

**Response `200`** — same shape as `/vectors/search`.

---

### `POST /vectors/embeddings`

Insert a pre-computed embedding for a document chunk or agent memory entry.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `embedding` | number[] | ✅ | Float32 vector (must match `dimensions`) |
| `documentChunkId` | string (UUID) | ❌* | Target document chunk |
| `agentMemoryId` | string (UUID) | ❌* | Target agent memory entry |
| `model` | string | ❌ | Model name (default `text-embedding-3-small`) |
| `dimensions` | number | ❌ | Vector dimensions (default `1536`) |

> *Exactly one of `documentChunkId` or `agentMemoryId` must be provided.

```bash
curl -X POST https://api.example.com/api/v1/vectors/embeddings \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"documentChunkId":"uuid","embedding":[0.1,...]}'
```

**Response `201`** — created `Embedding` object.

---

### `DELETE /vectors/embeddings/:id`

Delete an embedding by ID.

```bash
curl -X DELETE https://api.example.com/api/v1/vectors/embeddings/uuid \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `204`** — no body.

---

## Agent Memory

### `POST /memory`

Store or update a memory entry for an agent.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | ✅ | Agent identifier |
| `key` | string | ✅ | Memory key (unique per agent+tenant) |
| `value` | string | ✅ | Memory value |
| `memoryType` | string | ❌ | `SHORT_TERM` (default) or `LONG_TERM` |
| `ttlSeconds` | number | ❌ | Expiry in seconds from now |
| `metadata` | object | ❌ | Arbitrary metadata |

```bash
curl -X POST https://api.example.com/api/v1/memory \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","key":"user_preference","value":"dark mode","ttlSeconds":3600}'
```

**Response `201`** — created/updated `AgentMemory` object.

---

### `GET /memory/:agentId`

Recall all non-expired memory entries for an agent.

```bash
curl https://api.example.com/api/v1/memory/agent-1 \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `200`** — array of `AgentMemory` objects.

---

### `POST /memory/recall`

Semantic recall via cosine similarity over agent memory embeddings.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | ✅ | Agent to search memories for |
| `embedding` | number[] | ✅ | Query embedding vector |
| `topK` | number | ❌ | Max results (default `10`) |

```bash
curl -X POST https://api.example.com/api/v1/memory/recall \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","embedding":[0.1,...],"topK":3}'
```

**Response `200`**
```json
{ "results": [{ "id": "uuid", "score": 0.91, "content": "dark mode" }], "count": 1 }
```

---

### `DELETE /memory/:agentId/:key`

Forget a specific memory entry by agent ID and key.

```bash
curl -X DELETE https://api.example.com/api/v1/memory/agent-1/user_preference \
  -H "X-Tenant-Id: uuid" \
  -H "Authorization: Bearer avdb_..."
```

**Response `204`** — no body.
