# Event Bus Integration

Ascended-VectorDB is the durable store for all events emitted by the AscendStack ecosystem. Every event from Ascended-Event-Bus is persisted here, enabling full audit trails and time-travel debugging.

---

## Event Schema

| Field            | Type     | Description                                    |
|------------------|----------|------------------------------------------------|
| `id`             | UUID     | Unique event identifier                        |
| `tenant_id`      | String   | Tenant that owns this event                    |
| `type`           | String   | Event type (e.g. `execution.started`)          |
| `payload`        | JSON     | Raw event payload (preserved exactly)          |
| `execution_id`   | UUID?    | Linked execution (for traceability)            |
| `source`         | String?  | Originating service                            |
| `correlation_id` | String?  | Cross-service correlation ID                   |
| `timestamp`      | DateTime | When the event occurred                        |

---

## Ingesting Events

```bash
curl -X POST https://your-api/api/v1/events \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "document.processed",
    "payload": { "documentId": "doc-uuid", "chunks": 12 },
    "execution_id": "exec-uuid",
    "source": "ascended-document-engine",
    "correlation_id": "corr-abc123"
  }'
```

---

## Execution Timeline

Retrieve the full ordered event stream for an execution:

```bash
curl https://your-api/api/v1/executions/exec-uuid/events \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>"
```

Response:

```json
{
  "events": [
    { "type": "execution.started", "timestamp": "2026-03-25T20:00:00Z", "payload": {} },
    { "type": "task.completed", "timestamp": "2026-03-25T20:00:01Z", "payload": { "step": "parse" } },
    { "type": "execution.completed", "timestamp": "2026-03-25T20:00:02Z", "payload": {} }
  ]
}
```

---

## Connecting Ascended-Event-Bus

In your Ascended-Event-Bus subscriber, forward events to VectorDB:

```typescript
import { EventBus } from '@ascendstack/ascended-event-bus';

const bus = new EventBus({ redisUrl: process.env.REDIS_URL });
const VECTORDB = process.env.VECTORDB_URL;

bus.subscribe('*', async (event) => {
  await fetch(`${VECTORDB}/api/v1/events`, {
    method: 'POST',
    headers: {
      'X-Tenant-Id': event.tenantId,
      'Authorization': `Bearer ${process.env.VECTORDB_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: event.type,
      payload: event.payload,
      execution_id: event.executionId,
      source: event.source,
      correlation_id: event.correlationId,
    }),
  });
});
```

All events are stored with NO filtering — the full raw payload is preserved exactly as emitted.
