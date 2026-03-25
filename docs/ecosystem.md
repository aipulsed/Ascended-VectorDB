# AscendStack Ecosystem

Ascended-VectorDB is the central persistence and intelligence layer of the AscendStack ecosystem.

---

## Ecosystem Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AscendStack Ecosystem                   │
│                                                             │
│  [Ascended-SDK]           embeddings, typed interfaces      │
│        │                                                    │
│        ▼                                                    │
│  [Ascended-VectorDB] ◄──── [Ascended-Event-Bus]  events     │
│        │    ▲                                               │
│        │    └──────────── [DEL] execution state R/W         │
│        │                                                    │
│        ├◄───────────────── [Ascended-Agents]  memory R/W    │
│        │                                                    │
│        ├◄───────────────── [Ascended-Document-Engine]        │
│        │                   chunks + embeddings              │
│        │                                                    │
│        └──────────────────► [Next.js Apps]  REST API        │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Contracts

### Ascended-SDK (`@ascendstack/sdk`)
- **Provides:** embedding vectors (1536-dim float32), typed API payloads
- **Contract:** VectorDB never generates embeddings. All embeddings arrive via SDK.
- **Package:** `@ascendstack/sdk`

### Ascended-Event-Bus (`@ascendstack/ascended-event-bus`)
- **Provides:** domain events from all services
- **Contract:** ALL events are stored — no filtering. Raw payload preserved.
- **Integration:** Subscribe to `*` and POST to `/api/v1/events`
- **Package:** `@ascendstack/ascended-event-bus`

### Deterministic-Execution-Layer
- **Reads/writes:** execution state, task steps, retry counts
- **Contract:** atomic step updates, strong consistency, deterministic replay
- **Integration:** REST API calls to `/api/v1/executions`

### Ascended-Agents
- **Reads/writes:** agent memory (SHORT_TERM + LONG_TERM)
- **Contract:** per-agent isolation, semantic recall via vector search
- **Integration:** `/api/v1/memory` endpoints

### Ascended-Document-Engine
- **Provides:** parsed documents, text chunks, embeddings
- **Contract:** VectorDB stores chunk relationships and metadata, allows re-indexing
- **Integration:** POST to `/api/v1/documents`, `/api/v1/vectors/embeddings`

### Next.js Apps (Frontend)
- **Consumes:** documents, workflows, memory, analytics
- **Integration:** REST API with tenant API key authentication

---

## Why VectorDB is the Central Layer

| Capability              | How VectorDB provides it                      |
|-------------------------|-----------------------------------------------|
| Semantic search         | pgvector cosine similarity + hybrid search    |
| Execution traceability  | Execution + Task + Event tables               |
| Agent cognition memory  | AgentMemory + vector recall                   |
| Document intelligence   | Document + DocumentChunk + Embedding          |
| Business data storage   | Workflow + Tenant tables                      |
| Full audit trail        | Events linked to executions                   |
| Multi-tenant SaaS       | tenant_id on every row                        |

---

## Package Names and Repos

| Package                          | Repository                              |
|----------------------------------|-----------------------------------------|
| `@ascendstack/vectordb`          | aipulsed/Ascended-VectorDB (this repo)  |
| `@ascendstack/sdk`               | aipulsed/Ascended-SDK                   |
| `@ascendstack/ascended-event-bus`| aipulsed/Ascended-Event-Bus             |
| `deterministic-execution-layer`  | aipulsed/Deterministic-Execution-Layer  |
