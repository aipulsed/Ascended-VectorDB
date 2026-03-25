# Execution Tracking

Ascended-VectorDB is the state store for the Deterministic Execution Layer (DEL). Every pipeline run, every step, every retry is durably recorded here.

---

## Table of Contents

- [Execution Lifecycle](#execution-lifecycle)
- [Creating an Execution](#creating-an-execution)
- [Task Steps](#task-steps)
- [Retry Logic](#retry-logic)
- [Replay from Step](#replay-from-step)
- [Execution Timeline](#execution-timeline)
- [DEL Integration Pattern](#del-integration-pattern)

---

## Execution Lifecycle

```
PENDING → RUNNING → COMPLETED
                 ↘ FAILED
                 ↘ CANCELLED
                 ↘ PAUSED → RUNNING
```

| Status      | Description                                   |
|-------------|-----------------------------------------------|
| `PENDING`   | Created but not yet started                   |
| `RUNNING`   | Currently executing                           |
| `COMPLETED` | Finished successfully                         |
| `FAILED`    | Terminated with an error                      |
| `CANCELLED` | Manually cancelled                            |
| `PAUSED`    | Temporarily halted, can be resumed            |

---

## Creating an Execution

```bash
curl -X POST https://your-api/api/v1/executions \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "wf-uuid-optional",
    "input": { "userId": "user-123", "action": "process-document" }
  }'
```

Response:

```json
{
  "id": "exec-uuid",
  "status": "PENDING",
  "workflow_id": "wf-uuid-optional",
  "input": { "userId": "user-123" },
  "retries": 0,
  "max_retries": 3,
  "created_at": "2026-03-25T20:00:00.000Z"
}
```

---

## Task Steps

Each step in a pipeline is recorded as a `Task`:

```bash
# Append a task to an execution
curl -X POST https://your-api/api/v1/executions/exec-uuid/tasks \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "step_name": "embed-document",
    "type": "EMBEDDING",
    "input": { "chunkId": "chunk-uuid" }
  }'
```

Update a task when it completes:

```bash
curl -X PATCH https://your-api/api/v1/executions/exec-uuid/tasks/task-uuid \
  -d '{
    "status": "COMPLETED",
    "output": { "embeddingId": "emb-uuid" },
    "duration_ms": 342
  }'
```

### Task Status Flow

```
PENDING → RUNNING → COMPLETED
                 ↘ FAILED → RETRYING → RUNNING
                 ↘ SKIPPED
```

---

## Retry Logic

Executions support automatic retry tracking:

```typescript
// Service layer
const execution = await executionService.createExecution(tenantId, {
  workflow_id: workflowId,
  input: payload,
  max_retries: 3,
});

// On failure
await executionService.markFailed(tenantId, execution.id, 'Step timeout');

// Retry (increments retries counter)
await executionService.updateStatus(tenantId, execution.id, 'RUNNING');
```

The `retries` field tracks how many times an execution has been retried. When `retries >= max_retries`, the execution should be permanently failed.

---

## Replay from Step

The DEL uses `replayFromStep` to re-run a pipeline from a specific point without losing earlier history:

```typescript
await executionService.replayFromStep(tenantId, executionId, 'embed-document');
```

This:
1. Resets tasks from `step_name` onwards to `PENDING`
2. Sets execution status back to `RUNNING`
3. Preserves all earlier task outputs and events

---

## Execution Timeline

Fetch the full ordered event timeline for an execution:

```bash
curl https://your-api/api/v1/executions/exec-uuid/timeline \
  -H "X-Tenant-Id: <tenant-id>" \
  -H "Authorization: Bearer <key>"
```

Response:

```json
{
  "execution": { "id": "exec-uuid", "status": "COMPLETED" },
  "events": [
    { "id": "evt-1", "type": "execution.started", "timestamp": "..." },
    { "id": "evt-2", "type": "task.completed", "payload": { "step": "embed" }, "timestamp": "..." },
    { "id": "evt-3", "type": "execution.completed", "timestamp": "..." }
  ]
}
```

---

## DEL Integration Pattern

The Deterministic-Execution-Layer repo interacts with VectorDB via the REST API:

```typescript
// In your DEL service
const BASE = process.env.VECTORDB_URL;
const HEADERS = {
  'X-Tenant-Id': tenantId,
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
};

// 1. Start execution
const exec = await fetch(`${BASE}/api/v1/executions`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({ workflow_id: wfId, input: payload }),
}).then(r => r.json());

// 2. Record step start
await fetch(`${BASE}/api/v1/executions/${exec.id}/tasks`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify({ step_name: 'my-step', type: 'PROCESSING', input: stepInput }),
});

// 3. Mark complete
await fetch(`${BASE}/api/v1/executions/${exec.id}/status`, {
  method: 'PATCH',
  headers: HEADERS,
  body: JSON.stringify({ status: 'COMPLETED', output: result }),
});
```
