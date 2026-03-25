# Agent Memory System

Ascended-VectorDB provides a two-layer memory system for AI agents: fast key-value short-term memory and vector-indexed long-term semantic memory.

---

## Table of Contents

- [Memory Types](#memory-types)
- [Storing Memory](#storing-memory)
- [Key-Based Recall](#key-based-recall)
- [Semantic Recall](#semantic-recall)
- [Memory Expiry (TTL)](#memory-expiry-ttl)
- [Pruning Expired Memories](#pruning-expired-memories)
- [Agent Isolation](#agent-isolation)
- [Integration with Ascended-Agents](#integration-with-ascended-agents)

---

## Memory Types

| Type         | Storage       | Retrieval            | Use Case                         |
|--------------|---------------|----------------------|----------------------------------|
| `SHORT_TERM` | Key-value     | Exact key lookup     | Recent context, session state    |
| `LONG_TERM`  | Key-value + vector | Semantic search | Historical knowledge, learned facts |

---

## Storing Memory

```bash
curl -X POST https://your-api/api/v1/memory \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-sales-001",
    "key": "last-customer-context",
    "value": "Customer asked about enterprise pricing for 500 seats.",
    "memory_type": "SHORT_TERM"
  }'
```

For long-term memory with vector indexing, include the embedding:

```bash
curl -X POST https://your-api/api/v1/memory \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-sales-001",
    "key": "product-faq-answer-42",
    "value": "Enterprise plans include SSO, audit logs, and dedicated support.",
    "memory_type": "LONG_TERM",
    "embedding": [0.023, -0.041, ...],
    "metadata": { "source": "faq", "confidence": 0.97 }
  }'
```

> **Note:** Embeddings must be generated externally (via Ascended-SDK). VectorDB never generates embeddings internally.

---

## Key-Based Recall

Retrieve a specific memory entry by key:

```bash
curl https://your-api/api/v1/memory/agent-sales-001/last-customer-context \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>"
```

Response:

```json
{
  "id": "mem-uuid",
  "agent_id": "agent-sales-001",
  "key": "last-customer-context",
  "value": "Customer asked about enterprise pricing for 500 seats.",
  "memory_type": "SHORT_TERM",
  "expires_at": null,
  "created_at": "2026-03-25T20:00:00.000Z"
}
```

---

## Semantic Recall

Search long-term memory by semantic similarity:

```bash
curl -X POST https://your-api/api/v1/memory/recall \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-sales-001",
    "embedding": [0.021, -0.038, ...],
    "top_k": 5
  }'
```

Response:

```json
{
  "results": [
    {
      "id": "mem-uuid",
      "score": 0.94,
      "value": "Enterprise plans include SSO, audit logs, and dedicated support.",
      "key": "product-faq-answer-42",
      "metadata": { "source": "faq" }
    }
  ]
}
```

---

## Memory Expiry (TTL)

Short-term memories can be automatically expired by setting `expires_at`:

```json
{
  "agent_id": "agent-001",
  "key": "session-context",
  "value": "User is in checkout flow",
  "memory_type": "SHORT_TERM",
  "expires_at": "2026-03-25T21:00:00.000Z"
}
```

Expired memories are excluded from retrieval and can be cleaned up via the prune endpoint.

---

## Pruning Expired Memories

```bash
curl -X DELETE https://your-api/api/v1/memory/agent-sales-001/expired \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>"
```

This deletes all `AgentMemory` records where `expires_at < now()` for the given agent.

---

## Agent Isolation

Each agent is identified by `agent_id`. Memories are isolated per `(tenant_id, agent_id)` — an agent can never read another agent's memories.

The unique constraint `(tenant_id, agent_id, key)` means writing the same key updates the existing entry (upsert semantics).

---

## Integration with Ascended-Agents

```typescript
// In your agent service
const VECTORDB = process.env.VECTORDB_URL;

// Store context after each turn
async function storeContext(agentId: string, key: string, value: string) {
  await fetch(`${VECTORDB}/api/v1/memory`, {
    method: 'POST',
    headers: {
      'X-Tenant-Id': tenantId,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: agentId,
      key,
      value,
      memory_type: 'SHORT_TERM',
      expires_at: new Date(Date.now() + 3600_000).toISOString(), // 1h TTL
    }),
  });
}

// Semantic recall before responding
async function recallRelevantMemory(agentId: string, queryEmbedding: number[]) {
  const res = await fetch(`${VECTORDB}/api/v1/memory/recall`, {
    method: 'POST',
    headers: { 'X-Tenant-Id': tenantId, 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId, embedding: queryEmbedding, top_k: 3 }),
  });
  return res.json();
}
```
