# Deployment

This guide covers deploying Ascended-VectorDB to production.

---

## Docker Compose (Recommended)

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your values

# Start all services (PostgreSQL + pgvector, Redis, app)
docker compose -f docker/docker-compose.yml up -d

# Run migrations
docker compose exec app npx prisma migrate deploy
```

The `docker-compose.yml` starts:
- `postgres` — `pgvector/pgvector:pg16` image with the `vector` extension pre-installed
- `redis` — `redis:7-alpine` for caching
- `app` — the Ascended-VectorDB API server

---

## Environment Variables (Production)

```env
DATABASE_URL=postgresql://user:password@postgres:5432/vectordb?schema=public
REDIS_URL=redis://redis:6379
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
EMBEDDING_DIMENSIONS=1536
DEFAULT_TOP_K=10
CACHE_TTL_SECONDS=300
```

---

## Running Migrations

```bash
# In production (applies pending migrations, never resets data)
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate
```

---

## Health Checks

Use these endpoints with your load balancer / orchestrator:

| Endpoint         | Checks                         |
|------------------|--------------------------------|
| `GET /health`    | App is alive                   |
| `GET /health/db` | PostgreSQL connection          |
| `GET /health/redis` | Redis connection (optional) |

```bash
curl https://your-api/health
# { "status": "ok", "timestamp": "..." }
```

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`) for managed Postgres
- [ ] `REDIS_URL` uses TLS for managed Redis
- [ ] API keys rotated and stored in secrets manager
- [ ] `npx prisma migrate deploy` run before app start
- [ ] Health check endpoint configured in load balancer
- [ ] Log aggregation configured (LOG_LEVEL=warn in prod)
- [ ] Connection pooling configured (PgBouncer recommended for high concurrency)

---

## Scaling

The application is stateless — all state lives in PostgreSQL and Redis. Scale horizontally by running multiple app instances behind a load balancer. The database and Redis must be shared across all instances.

For high vector search throughput, ensure PostgreSQL has adequate RAM for the HNSW index to be held in memory (`shared_buffers` and `work_mem`).
