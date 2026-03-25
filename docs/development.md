# Development Guide

This guide explains the project structure and how to extend Ascended-VectorDB.

---

## Project Structure

```
ascended-vectordb/
├── src/
│   ├── index.ts              # Express app bootstrap + graceful shutdown
│   ├── config/
│   │   └── index.ts          # Zod-validated environment configuration
│   ├── lib/
│   │   ├── prisma.ts         # Prisma client singleton (tenant guard, slow-query logging)
│   │   ├── redis.ts          # ioredis client singleton
│   │   └── logger.ts         # Winston structured JSON logger
│   ├── types/
│   │   └── index.ts          # Shared TypeScript interfaces + Prisma re-exports
│   ├── repositories/
│   │   ├── base.repository.ts            # Abstract CRUD interface
│   │   ├── workflow.repository.ts
│   │   ├── execution.repository.ts
│   │   ├── task.repository.ts
│   │   ├── event.repository.ts
│   │   ├── document.repository.ts
│   │   ├── document-chunk.repository.ts
│   │   ├── embedding.repository.ts       # pgvector search
│   │   └── agent-memory.repository.ts
│   ├── services/
│   │   ├── execution.service.ts
│   │   ├── vector.service.ts
│   │   ├── event.service.ts
│   │   ├── document.service.ts
│   │   ├── agent-memory.service.ts
│   │   └── tenant.service.ts
│   ├── middleware/
│   │   ├── tenant.middleware.ts     # X-Tenant-Id extraction
│   │   ├── auth.middleware.ts       # API key validation
│   │   ├── error.middleware.ts      # Global error handler
│   │   └── validation.middleware.ts # Zod request validation
│   ├── api/routes/
│   │   ├── index.ts          # Route aggregator
│   │   ├── health.routes.ts
│   │   ├── tenant.routes.ts
│   │   ├── workflow.routes.ts
│   │   ├── execution.routes.ts
│   │   ├── event.routes.ts
│   │   ├── document.routes.ts
│   │   ├── vector.routes.ts
│   │   └── memory.routes.ts
│   └── utils/
│       ├── chunking.ts       # Text chunking strategies
│       ├── pagination.ts     # Pagination helpers
│       ├── validation.ts     # Common Zod schemas
│       └── cache.ts          # Redis cache helpers
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # SQL migration files
├── tests/unit/               # Vitest unit tests
├── docker/                   # Docker Compose + Dockerfile
└── docs/                     # This documentation
```

---

## npm Scripts

| Script           | Description                                      |
|------------------|--------------------------------------------------|
| `npm run build`  | Compile TypeScript to `dist/`                    |
| `npm run dev`    | Start with hot-reload (ts-node-dev)              |
| `npm run start`  | Run compiled `dist/index.js`                     |
| `npm test`       | Run all tests (vitest)                           |
| `npm run typecheck` | TypeScript type check without emit            |
| `npm run lint`   | ESLint                                           |
| `npm run db:migrate` | Run pending Prisma migrations               |
| `npm run db:generate` | Regenerate Prisma client                   |
| `npm run db:push` | Push schema directly (dev only)                |
| `npm run db:studio` | Open Prisma Studio                           |

---

## Adding a New Repository

1. Create `src/repositories/my-entity.repository.ts`
2. Extend `BaseRepository<Model, CreateInput, UpdateInput>`
3. Implement `create`, `findById`, `list`, `update`, `delete` — all accepting `tenantId` as first arg
4. Export a singleton: `export const myEntityRepository = new MyEntityRepository()`

---

## Adding a New Service

1. Create `src/services/my-entity.service.ts`
2. Import the relevant repository
3. Implement business logic methods that call repository methods
4. Export a singleton: `export const myEntityService = new MyEntityService()`

---

## Adding a New Route

1. Create `src/api/routes/my-entity.routes.ts`
2. Create an Express `Router`
3. Apply `tenantMiddleware` and `authMiddleware` to protected routes
4. Use `validateRequest` for body/query validation
5. Register it in `src/api/routes/index.ts`

---

## Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- --coverage      # With coverage report
```

Tests live in `tests/unit/`. Use vitest mocking (`vi.mock`) for Prisma and Redis.

---

## Code Style

- **TypeScript strict mode** — no implicit `any`
- **Prettier** — auto-format on save (`.prettierrc`)
- **ESLint** — TypeScript rules (`.eslintrc.json`)
- **Named exports** — prefer named over default exports
- **JSDoc comments** — on all public classes and functions
