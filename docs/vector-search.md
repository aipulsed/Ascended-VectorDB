# Vector Search

Ascended-VectorDB uses the **pgvector** PostgreSQL extension to store and search high-dimensional embeddings. All vectors are 1536-dimensional float32 arrays produced by **OpenAI `text-embedding-3-small`** and injected via the Ascended-SDK — the VectorDB never calls OpenAI directly.

---

## pgvector Extension Setup

The `pgvector` extension is enabled automatically via the Prisma schema:

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [uuidOssp(map: "uuid-ossp"), vector]
}
```

The Docker Compose setup uses the official `pgvector/pgvector:pg16` image, which includes the extension pre-installed. For manual installs:

```bash
# Ubuntu / Debian
sudo apt install postgresql-16-pgvector

# Then in psql:
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Embedding Format

| Property | Value |
|---|---|
| Model | `text-embedding-3-small` (OpenAI) |
| Dimensions | `1536` |
| Element type | `float32` |
| Storage column | `vector(1536)` (pgvector native type) |

Embeddings are **never generated internally**. The application receives pre-computed float32 arrays from the caller (typically `@ascendstack/sdk`) and stores them via raw SQL using the `::vector` cast:

```sql
INSERT INTO "Embedding" (..., embedding, ...)
VALUES (..., '[0.1,0.2,...]'::vector, ...)
```

---

## Cosine Similarity

Vector search uses the pgvector **`<=>` operator**, which computes **cosine distance** (not similarity). The returned score is `1 - cosine_distance`, so higher scores are better.

```sql
SELECT
  dc.id,
  1 - (e.embedding <=> '[0.1,0.2,...]'::vector) AS score,
  dc.content,
  dc.metadata,
  dc.document_id,
  dc.chunk_index
FROM "Embedding" e
JOIN "DocumentChunk" dc ON e.document_chunk_id = dc.id
WHERE e.tenant_id = $tenantId
ORDER BY e.embedding <=> '[0.1,0.2,...]'::vector
LIMIT $topK
```

---

## Index Types

### HNSW (Hierarchical Navigable Small World)

**Recommended for most workloads.**

```sql
CREATE INDEX ON "Embedding" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

| Parameter | Value | Effect |
|---|---|---|
| `m` | `16` | Number of bi-directional links per node — higher = better recall, more memory |
| `ef_construction` | `64` | Build-time search width — higher = better index quality, slower build |

**When to use:** Online workloads where inserts and queries happen concurrently. HNSW indexes are updated incrementally without full rebuilds.

### IVFFlat (Inverted File with Flat Quantization)

```sql
CREATE INDEX ON "Embedding" USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

| Parameter | Value | Effect |
|---|---|---|
| `lists` | `100` | Number of Voronoi cells — set to `sqrt(N)` for N rows |

**When to use:** Bulk-loaded, mostly-read datasets. Requires the index to be built after data is loaded. Not updated incrementally — rebuilding is expensive on large tables.

**Rule of thumb:**
- Development / small datasets (< 100k vectors): HNSW with defaults.
- Production bulk loads (millions of vectors, infrequent writes): IVFFlat with `lists = sqrt(N)`.
- Production mixed workloads: HNSW.

---

## Top-K Search API

```typescript
import { vectorService } from './services/vector.service';

const results = await vectorService.searchSimilar({
  tenantId: 'tenant-uuid',
  embedding: myEmbeddingArray,  // number[1536]
  topK: 5,
});

// results: SearchResult[]
// { id, score, content, metadata, documentId, chunkIndex }
```

Via REST:

```bash
curl -X POST https://api.example.com/api/v1/vectors/search \
  -H "X-Tenant-Id: tenant-uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{
    "embedding": [0.023, -0.015, ...],
    "topK": 5
  }'
```

---

## Hybrid Search

Hybrid search combines **cosine vector similarity** with **PostgreSQL full-text search** (`ts_rank`). The final score is:

```
score = vectorWeight × vector_score + (1 - vectorWeight) × keyword_score
```

Default `vectorWeight` is `0.7` (70% vector, 30% keyword).

```typescript
const results = await vectorService.hybridSearch({
  tenantId: 'tenant-uuid',
  embedding: myEmbeddingArray,
  query: 'database configuration guide',
  topK: 10,
  vectorWeight: 0.7,
});
```

Via REST:

```bash
curl -X POST https://api.example.com/api/v1/vectors/hybrid-search \
  -H "X-Tenant-Id: tenant-uuid" \
  -H "Authorization: Bearer avdb_..." \
  -H "Content-Type: application/json" \
  -d '{
    "embedding": [0.023, -0.015, ...],
    "query": "database configuration guide",
    "topK": 10,
    "vectorWeight": 0.8
  }'
```

**When to use hybrid search:**
- User-facing search where keyword precision matters (e.g., exact product names, identifiers)
- When the query has highly specific terms unlikely to be captured by semantic similarity alone
- RAG pipelines where both semantic meaning and keyword precision are required

**When to use pure vector search:**
- Semantic similarity / "find similar content" queries
- Multilingual content where keyword matching is unreliable
- Agent memory recall based on conceptual similarity

---

## Chunking Strategies

Before inserting embeddings, documents must be split into chunks. Three strategies are available in `src/utils/chunking.ts`:

### Fixed Size

```typescript
import { fixedSizeChunk } from './utils/chunking';

const chunks = fixedSizeChunk(text, 1000, 200);
// size=1000 chars per chunk, overlap=200 chars
```

- Predictable chunk boundaries
- Good for uniform content (code, structured data)
- Overlap prevents context loss at boundaries

### Sliding Window

```typescript
import { slidingWindowChunk } from './utils/chunking';

const chunks = slidingWindowChunk(text, 1000, 500);
// chunkSize=1000 chars, step=500 chars
```

- More overlap than fixed-size (step < size)
- Better recall for queries that straddle chunk boundaries
- Higher storage cost (more chunks per document)

### Semantic (Paragraph-Based)

```typescript
import { semanticChunk } from './utils/chunking';

const chunks = semanticChunk(text);
// Splits on double newlines (\n\n+), trims whitespace
```

- Preserves natural document structure
- Variable chunk sizes — appropriate for prose/markdown
- Best for documents with clear paragraph boundaries

---

## Full Example: Document → Chunks → Embeddings → Search

```typescript
import { fixedSizeChunk } from './utils/chunking';

// 1. Ingest document (creates Document + DocumentChunk records)
const response = await fetch('/api/v1/documents', {
  method: 'POST',
  headers: {
    'X-Tenant-Id': tenantId,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    filename: 'guide.md',
    contentType: 'text/markdown',
    content: longDocumentText,
    chunkSize: 1000,
    chunkOverlap: 200,
  }),
});
const { document, chunks } = await response.json();

// 2. Generate embeddings externally (e.g., via @ascendstack/sdk)
for (const chunk of chunks) {
  const embedding = await sdk.embed(chunk.content); // number[1536]

  // 3. Insert embedding
  await fetch('/api/v1/vectors/embeddings', {
    method: 'POST',
    headers: { 'X-Tenant-Id': tenantId, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentChunkId: chunk.id,
      embedding,
    }),
  });
}

// 4. Search
const queryEmbedding = await sdk.embed('How do I configure the database?');
const { results } = await fetch('/api/v1/vectors/search', {
  method: 'POST',
  headers: { 'X-Tenant-Id': tenantId, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ embedding: queryEmbedding, topK: 5 }),
}).then(r => r.json());

console.log(results[0].content); // Most relevant chunk
```

---

## Performance Tuning

### `topK`

Lower values are faster. For RAG pipelines, `topK=5–10` is usually sufficient. For exploratory search, use `topK=20–50`.

### `vectorWeight` (hybrid search)

- `1.0` — pure vector search (ignore keywords)
- `0.0` — pure full-text search (ignore embeddings)
- `0.7` — recommended default for RAG

### HNSW `ef_search`

Set at query time for a tradeoff between speed and recall:

```sql
SET hnsw.ef_search = 100;  -- higher = better recall, slower
```

Default is `40`. For production, `100` gives excellent recall with minimal latency overhead.

### IVFFlat `probes`

```sql
SET ivfflat.probes = 10;  -- probe 10 out of 100 lists
```

Higher probes = better recall. `probes = lists` is exact (no ANN approximation).

### Connection Pooling

For high-throughput vector workloads, set `connection_limit` in `DATABASE_URL`:

```
DATABASE_URL=postgresql://...?connection_limit=20&pool_timeout=10
```
