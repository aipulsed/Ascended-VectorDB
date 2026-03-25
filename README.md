# Ascended-VectorDB

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![pgvector](https://img.shields.io/badge/pgvector-0.7-orange)](https://github.com/pgvector/pgvector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **AI-native vector database layer for the AscendStack ecosystem**

Ascended-VectorDB is the persistent intelligence backbone of the AscendStack platform. It combines PostgreSQL's relational reliability with pgvector's high-performance approximate nearest-neighbour search to give every AscendStack service a unified store for embeddings, agent memory, document chunks, workflow executions, and domain events — all enforced under strict multi-tenancy.

---

## Table of Contents

- [Overview](#overview)
- [Feature Highlights](#feature-highlights)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Overview](#api-overview)
- [AscendStack Ecosystem](#ascendstack-ecosystem)
- [Documentation](#documentation)
- [License](#license)

---

## Overview

Ascended-VectorDB exposes a REST API (`/api/v1`) backed by:

- **PostgreSQL 16 + pgvector** – HNSW/IVFFlat vector similarity search over 1 536-dimension embeddings
- **Prisma ORM** – type-safe schema, migrations, and tenant-scoped query middleware
- **Redis (optional)** – result caching with configurable TTL
- **Express + Zod** – validated, schema-driven HTTP layer

It serves as the shared state store for every other AscendStack service: the Deterministic Execution Layer writes execution state here, Ascended-Agents reads and writes memory here, and the Ascended-Document-Engine pushes chunks and embeddings here.

---

## Feature Highlights

- 🧠 **Vector search** — cosine similarity search over document chunks and agent memories
- 🔀 **Hybrid search** — weighted combination of vector similarity and full-text keyword scoring
- 📄 **Document ingestion** — fixed-size, sliding-window, or semantic paragraph chunking
- 🤖 **Agent memory** — SHORT_TERM / LONG_TERM key/value store with TTL and semantic recall
- ⚙️ **Workflow & execution tracking** — full DEL lifecycle (PENDING → RUNNING → COMPLETED/FAILED)
- 📋 **Task step tracking** — per-step status, duration, and retry counts
- 📡 **Event bus integration** — durable domain-event storage with execution linkage
- 🏢 **Multi-tenancy** — every row scoped to a tenant; enforced at middleware and repository layers
- 🔑 **API key auth** — SHA-256-hashed keys with scopes and expiry
- 🐳 **Docker-first** — single `docker compose up` for postgres + redis + app
- 📊 **Health probes** — `/health`, `/health/db`, `/health/redis` for orchestrators

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AscendStack Clients                       │
│  Ascended-SDK  │  Ascended-Agents  │  DEL  │  Document-Engine   │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP  (X-Tenant-Id + Bearer token)
┌────────────────────────▼────────────────────────────────────────┐
│                   Express API  /api/v1                           │
│  tenants  workflows  executions  tasks  events                   │
│  documents  vectors  memory  health                              │
├──────────────────────────────────────────────────────────────────┤
│              Auth + Tenant Middleware (per request)              │
├──────────────────────────────────────────────────────────────────┤
│                        Service Layer                             │
│  VectorService  DocumentService  AgentMemoryService              │
│  ExecutionService  EventService  TenantService                   │
├──────────────────────────────────────────────────────────────────┤
│                      Repository Layer                            │
│  EmbeddingRepository  DocumentChunkRepository  AgentMemory…      │
│  ExecutionRepository  WorkflowRepository  EventRepository        │
├──────────────────────────────────────────────────────────────────┤
│  Prisma ORM + pgvector raw SQL        │  ioredis (optional)      │
├───────────────────────────────────────┼──────────────────────────┤
│       PostgreSQL 16 + pgvector        │        Redis 7           │
└───────────────────────────────────────┴──────────────────────────┘
```

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/Ascended-VectorDB.git
cd Ascended-VectorDB
pnpm install

# 2. Copy and edit env vars
cp .env.example .env
# Set DATABASE_URL at minimum

# 3. Run migrations and start
pnpm db:migrate
pnpm dev
# → Listening on http://localhost:3000

# OR — Docker (zero local dependencies)
docker compose -f docker/docker-compose.yml up
```

---

## Installation

**Prerequisites:** Node.js ≥ 20, pnpm ≥ 8, PostgreSQL 16 with the `pgvector` extension, Redis (optional).

```bash
pnpm install
```

Build for production:

```bash
pnpm build          # emits to dist/
pnpm start          # runs dist/index.js
```

---

## Configuration

All configuration is read from environment variables and validated on startup with Zod.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `REDIS_URL` | ❌ | — | Redis connection string; disables caching if absent |
| `PORT` | ❌ | `3000` | HTTP server port |
| `NODE_ENV` | ❌ | `development` | `development` \| `test` \| `production` |
| `LOG_LEVEL` | ❌ | `info` | Winston log level |
| `EMBEDDING_DIMENSIONS` | ❌ | `1536` | Vector dimensionality (must match your model) |
| `DEFAULT_TOP_K` | ❌ | `10` | Default number of results for vector search |
| `CACHE_TTL_SECONDS` | ❌ | `300` | Redis cache TTL in seconds |

See [docs/configuration.md](docs/configuration.md) for full details.

---

## API Overview

Base URL: `http://localhost:3000/api/v1`

All endpoints except `/health` and `POST /tenants` require:
- `Authorization: Bearer <api-key>`
- `X-Tenant-Id: <tenant-uuid>`

### Create a tenant

```bash
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "slug": "acme-corp"}'
```

### Vector search

```bash
curl -X POST http://localhost:3000/api/v1/vectors/search \
  -H "Authorization: Bearer <key>" \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{"embedding": [0.1, 0.2, ...], "topK": 5}'
```

### Store agent memory

```bash
curl -X POST http://localhost:3000/api/v1/memory \
  -H "Authorization: Bearer <key>" \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent-1", "key": "user_preference", "value": "dark mode", "memoryType": "LONG_TERM"}'
```

See [docs/api-reference.md](docs/api-reference.md) for the complete API reference.

---

## AscendStack Ecosystem

```
┌──────────────────────────────────────────────────────────┐
│                     AscendStack                          │
│                                                          │
│  ┌─────────────────┐    ┌──────────────────────────┐    │
│  │  Ascended-SDK   │───▶│    Ascended-VectorDB      │    │
│  └─────────────────┘    │  (this service)           │    │
│                         └────────────┬─────────────┘    │
│  ┌─────────────────┐                 │                   │
│  │ Ascended-Event  │────embeddings───┘                   │
│  │     -Bus        │────events───────▶                   │
│  └─────────────────┘                                     │
│  ┌──────────────────────┐                                │
│  │  Deterministic-      │────execution state────▶        │
│  │  Execution-Layer     │                                │
│  └──────────────────────┘                                │
│  ┌─────────────────┐                                     │
│  │ Ascended-Agents │────memory read/write────▶           │
│  └─────────────────┘                                     │
│  ┌──────────────────────┐                                │
│  │ Ascended-Document    │────chunks + embeddings──▶      │
│  │     -Engine          │                                │
│  └──────────────────────┘                                │
└──────────────────────────────────────────────────────────┘
```

See [docs/ecosystem.md](docs/ecosystem.md) for the full integration guide.

---

## Documentation

| Document | Description |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | Step-by-step setup guide |
| [docs/configuration.md](docs/configuration.md) | All environment variables |
| [docs/api-reference.md](docs/api-reference.md) | Complete REST API reference |
| [docs/architecture.md](docs/architecture.md) | System architecture deep-dive |
| [docs/data-model.md](docs/data-model.md) | Database schema reference |
| [docs/vector-search.md](docs/vector-search.md) | Vector search guide |
| [docs/multi-tenancy.md](docs/multi-tenancy.md) | Multi-tenancy model |
| [docs/execution-tracking.md](docs/execution-tracking.md) | DEL integration |
| [docs/agent-memory.md](docs/agent-memory.md) | Agent memory system |
| [docs/event-bus-integration.md](docs/event-bus-integration.md) | Event bus integration |
| [docs/deployment.md](docs/deployment.md) | Production deployment |
| [docs/development.md](docs/development.md) | Developer guide |
| [docs/ecosystem.md](docs/ecosystem.md) | AscendStack ecosystem map |

---

## License

MIT © AscendStack Contributors
