# Configuration Reference

All configuration is supplied through environment variables. Ascended-VectorDB validates every variable at startup using [Zod](https://zod.dev/). If validation fails the process exits with a descriptive error listing every invalid field.

---

## Variables

### `DATABASE_URL`

| | |
|---|---|
| **Type** | `string` (URL) |
| **Required** | ✅ Yes |
| **Default** | — |
| **Example** | `postgresql://postgres:password@localhost:5432/vectordb?schema=public` |

PostgreSQL connection string. The database must have the `vector` and `uuid-ossp` extensions installed. Prisma uses this URL for both migrations and runtime queries.

```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname?schema=public"
```

---

### `REDIS_URL`

| | |
|---|---|
| **Type** | `string` (URL) |
| **Required** | ❌ Optional |
| **Default** | — (Redis disabled) |
| **Example** | `redis://localhost:6379` |

When set, enables the Redis result cache. If omitted, all cache operations are no-ops and every request hits the database directly. For production workloads with repeated identical queries, Redis is strongly recommended.

```bash
REDIS_URL="redis://localhost:6379"
# With password:
REDIS_URL="redis://:password@localhost:6379"
# With TLS (Upstash, etc.):
REDIS_URL="rediss://default:password@host:6379"
```

---

### `PORT`

| | |
|---|---|
| **Type** | `integer` (1–65535) |
| **Required** | ❌ Optional |
| **Default** | `3000` |
| **Example** | `8080` |

The TCP port the Express HTTP server binds to.

---

### `NODE_ENV`

| | |
|---|---|
| **Type** | `"development"` \| `"test"` \| `"production"` |
| **Required** | ❌ Optional |
| **Default** | `"development"` |
| **Example** | `production` |

Controls log formatting (JSON in production, pretty-printed in development) and other runtime behaviours. Always set to `production` in deployed environments.

---

### `LOG_LEVEL`

| | |
|---|---|
| **Type** | `"error"` \| `"warn"` \| `"info"` \| `"http"` \| `"verbose"` \| `"debug"` \| `"silly"` |
| **Required** | ❌ Optional |
| **Default** | `"info"` |
| **Example** | `debug` |

Winston log level. In production, `"info"` or `"warn"` is recommended to reduce log volume. Use `"debug"` or `"http"` during development to see request details and Prisma queries.

---

### `EMBEDDING_DIMENSIONS`

| | |
|---|---|
| **Type** | `integer` (positive) |
| **Required** | ❌ Optional |
| **Default** | `1536` |
| **Example** | `3072` |

The expected dimensionality of every embedding vector. This must match the output dimensions of your embedding model. The `VectorService` rejects insertions where `embedding.length !== EMBEDDING_DIMENSIONS`.

Common values:
- `1536` — OpenAI `text-embedding-3-small` / `text-embedding-ada-002`
- `3072` — OpenAI `text-embedding-3-large`
- `768` — Sentence-Transformers `all-MiniLM-L6-v2`

> **Note:** Changing this value after data has been inserted requires re-creating the `vector(N)` column and reindexing all embeddings.

---

### `DEFAULT_TOP_K`

| | |
|---|---|
| **Type** | `integer` (positive) |
| **Required** | ❌ Optional |
| **Default** | `10` |
| **Example** | `20` |

The default number of nearest-neighbour results returned by vector and hybrid search endpoints when the client does not supply a `topK` parameter. Clients may override this per-request up to `100`.

---

### `CACHE_TTL_SECONDS`

| | |
|---|---|
| **Type** | `integer` (positive) |
| **Required** | ❌ Optional |
| **Default** | `300` |
| **Example** | `600` |

Time-to-live in seconds for Redis cache entries. After this duration, cached results are evicted and the next request fetches fresh data from PostgreSQL.

---

## Example `.env` File

```bash
# Required
DATABASE_URL="postgresql://postgres:password@localhost:5432/vectordb?schema=public"

# Optional — recommended for production
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
EMBEDDING_DIMENSIONS=1536
DEFAULT_TOP_K=10
CACHE_TTL_SECONDS=300
```

---

## Validation Errors

If a required variable is missing or a value fails type/range validation, the server will exit immediately with output like:

```
Error: Invalid environment configuration:
  DATABASE_URL: Must be a valid connection string
  PORT: Expected number, received nan
```

Fix the reported variables and restart.
