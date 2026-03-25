# Multi-Tenancy

Ascended-VectorDB is built as a fully multi-tenant system. Every resource belongs to a tenant, and tenant isolation is enforced at every layer of the stack.

---

## Table of Contents

- [Tenant Model](#tenant-model)
- [Authentication Headers](#authentication-headers)
- [API Key Authentication](#api-key-authentication)
- [Repository Isolation](#repository-isolation)
- [Prisma Tenant Guard](#prisma-tenant-guard)
- [Creating a Tenant](#creating-a-tenant)
- [Generating an API Key](#generating-an-api-key)
- [Making Authenticated Requests](#making-authenticated-requests)
- [Tenant Plans](#tenant-plans)
- [SaaS vs Self-Hosted](#saas-vs-self-hosted)

---

## Tenant Model

Every row in every table (except `Tenant` itself) carries a `tenant_id` column. This is the primary isolation boundary. No query can ever return data from another tenant.

```
Tenant
 └─ id (UUID)
 └─ slug (unique)
 └─ plan: free | pro | enterprise
 └─ isActive
```

---

## Authentication Headers

All tenant-scoped endpoints require the `X-Tenant-Id` header:

```bash
curl https://your-api/api/v1/executions \
  -H "X-Tenant-Id: <your-tenant-id>" \
  -H "Authorization: Bearer <your-api-key>"
```

If the header is missing, the API returns:

```json
{ "error": "X-Tenant-Id header is required" }
```

---

## API Key Authentication

API keys are SHA-256 hashed before storage. The plaintext key is only returned once at creation time.

**Key format:** `avdb_<random-hex-string>`

**Storage:** Only `SHA-256(key)` is stored in `ApiKey.key_hash`.

On each request, the middleware:
1. Extracts the Bearer token from `Authorization` header
2. Hashes it with SHA-256
3. Looks up the hash in `ApiKey` filtered by `tenant_id`
4. Validates `is_active` and `expires_at`
5. Updates `last_used_at`

---

## Repository Isolation

Every repository method accepts `tenantId` as its first argument and applies it to every query:

```typescript
// All queries filter by tenant_id automatically
async findById(tenantId: string, id: string) {
  return prisma.execution.findFirst({
    where: { id, tenant_id: tenantId },
  });
}
```

This means even if a caller provides a valid UUID that belongs to another tenant, the query returns `null`.

---

## Prisma Tenant Guard

The Prisma client singleton in `src/lib/prisma.ts` includes middleware that validates `tenant_id` on all write operations:

```typescript
prisma.$use(async (params, next) => {
  const writeMutations = ['create', 'createMany', 'update', 'upsert'];
  if (writeMutations.includes(params.action) && params.model !== 'Tenant') {
    const data = params.args?.data;
    if (!data?.tenant_id) {
      throw new Error(`tenant_id is required for ${params.model}.${params.action}`);
    }
  }
  return next(params);
});
```

This is a defence-in-depth guard — no record can ever be created without a `tenant_id`.

---

## Creating a Tenant

```bash
curl -X POST https://your-api/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "pro"
  }'
```

Response:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "plan": "pro",
  "isActive": true,
  "created_at": "2026-03-25T20:00:00.000Z"
}
```

---

## Generating an API Key

```bash
curl -X POST https://your-api/api/v1/tenants/550e8400.../api-keys \
  -H "Content-Type: application/json" \
  -d '{ "name": "production-key", "scopes": ["read", "write"] }'
```

Response (key only shown once):

```json
{
  "id": "...",
  "name": "production-key",
  "key": "avdb_a1b2c3d4e5f6...",
  "scopes": ["read", "write"],
  "created_at": "2026-03-25T20:00:00.000Z"
}
```

---

## Making Authenticated Requests

```bash
# Every API call requires both headers
curl https://your-api/api/v1/workflows \
  -H "X-Tenant-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer avdb_a1b2c3d4e5f6..."
```

---

## Tenant Plans

| Plan       | Description                        |
|------------|------------------------------------|
| `free`     | Default plan, limited throughput   |
| `pro`      | Higher limits, full features       |
| `enterprise` | Unlimited, dedicated support     |

Plans are stored on the `Tenant.plan` field and can be used by your application layer to enforce feature gates.

---

## SaaS vs Self-Hosted

**SaaS mode:** Multiple tenants share one database. All data is isolated by `tenant_id`. Row-level security can be added at the PostgreSQL level as an additional guard.

**Self-hosted / enterprise mode:** Each customer runs their own instance. The `tenant_id` field can be set to a fixed value (e.g., the company's UUID). Multi-tenancy adds zero overhead in this mode.
