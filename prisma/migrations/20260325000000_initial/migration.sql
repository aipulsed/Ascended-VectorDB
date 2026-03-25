-- Migration: 20260325000000_initial
-- Initial schema for @ascendstack/vectordb
-- Creates all tables with pgvector extension support, HNSW and IVFFlat indexes.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'RETRYING');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "MemoryType" AS ENUM ('SHORT_TERM', 'LONG_TERM');

-- Tenant
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "name"       TEXT        NOT NULL,
    "slug"       TEXT        NOT NULL,
    "plan"       TEXT        NOT NULL DEFAULT 'free',
    "isActive"   BOOLEAN     NOT NULL DEFAULT true,
    "metadata"   JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant" ("slug");

-- Workflow
CREATE TABLE IF NOT EXISTS "Workflow" (
    "id"          UUID             NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"   TEXT             NOT NULL,
    "name"        TEXT             NOT NULL,
    "description" TEXT,
    "definition"  JSONB            NOT NULL,
    "status"      "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "version"     INTEGER          NOT NULL DEFAULT 1,
    "created_at"  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- Execution
CREATE TABLE IF NOT EXISTS "Execution" (
    "id"           UUID              NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"    TEXT              NOT NULL,
    "workflow_id"  UUID,
    "status"       "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "input"        JSONB,
    "output"       JSONB,
    "error"        TEXT,
    "started_at"   TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "retries"      INTEGER           NOT NULL DEFAULT 0,
    "max_retries"  INTEGER           NOT NULL DEFAULT 3,
    "created_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ       NOT NULL DEFAULT now(),
    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Execution_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Execution_tenant_id_status_idx"    ON "Execution" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "Execution_workflow_id_idx"         ON "Execution" ("workflow_id");
CREATE INDEX IF NOT EXISTS "Execution_tenant_id_created_at_idx" ON "Execution" ("tenant_id", "created_at");

-- Task
CREATE TABLE IF NOT EXISTS "Task" (
    "id"           UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"    TEXT         NOT NULL,
    "execution_id" UUID         NOT NULL,
    "step_name"    TEXT         NOT NULL,
    "type"         TEXT         NOT NULL,
    "status"       "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "input"        JSONB,
    "output"       JSONB,
    "error"        TEXT,
    "retries"      INTEGER      NOT NULL DEFAULT 0,
    "started_at"   TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "duration_ms"  INTEGER,
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Task_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Task_execution_id_idx"    ON "Task" ("execution_id");
CREATE INDEX IF NOT EXISTS "Task_tenant_id_status_idx" ON "Task" ("tenant_id", "status");

-- Event
CREATE TABLE IF NOT EXISTS "Event" (
    "id"             UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"      TEXT        NOT NULL,
    "type"           TEXT        NOT NULL,
    "payload"        JSONB       NOT NULL,
    "execution_id"   UUID,
    "source"         TEXT,
    "correlation_id" TEXT,
    "timestamp"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Event_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "Execution"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Event_tenant_id_type_idx"      ON "Event" ("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "Event_execution_id_idx"        ON "Event" ("execution_id");
CREATE INDEX IF NOT EXISTS "Event_tenant_id_timestamp_idx" ON "Event" ("tenant_id", "timestamp");

-- Document
CREATE TABLE IF NOT EXISTS "Document" (
    "id"           UUID             NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"    TEXT             NOT NULL,
    "filename"     TEXT             NOT NULL,
    "content_type" TEXT             NOT NULL,
    "size_bytes"   INTEGER,
    "status"       "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "storage_url"  TEXT,
    "metadata"     JSONB,
    "created_at"   TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "deleted_at"   TIMESTAMPTZ,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Document_tenant_id_status_idx" ON "Document" ("tenant_id", "status");

-- DocumentChunk
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
    "id"          UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"   TEXT        NOT NULL,
    "document_id" UUID        NOT NULL,
    "content"     TEXT        NOT NULL,
    "chunk_index" INTEGER     NOT NULL,
    "token_count" INTEGER,
    "metadata"    JSONB,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentChunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DocumentChunk_document_id_idx" ON "DocumentChunk" ("document_id");
CREATE INDEX IF NOT EXISTS "DocumentChunk_tenant_id_idx"   ON "DocumentChunk" ("tenant_id");

-- Full-text search index on DocumentChunk content
CREATE INDEX IF NOT EXISTS "DocumentChunk_content_fts_idx" ON "DocumentChunk" USING gin(to_tsvector('english', "content"));

-- Embedding
CREATE TABLE IF NOT EXISTS "Embedding" (
    "id"                UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"         TEXT        NOT NULL,
    "document_chunk_id" UUID        UNIQUE,
    "agent_memory_id"   UUID        UNIQUE,
    "model"             TEXT        NOT NULL DEFAULT 'text-embedding-3-small',
    "dimensions"        INTEGER     NOT NULL DEFAULT 1536,
    "embedding"         vector(1536),
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Embedding_document_chunk_id_fkey" FOREIGN KEY ("document_chunk_id") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Embedding_agent_memory_id_fkey" FOREIGN KEY ("agent_memory_id") REFERENCES "AgentMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Embedding_tenant_id_idx"         ON "Embedding" ("tenant_id");
CREATE INDEX IF NOT EXISTS "Embedding_document_chunk_id_idx" ON "Embedding" ("document_chunk_id");

-- HNSW index for fast approximate nearest-neighbor search (cosine similarity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embedding_hnsw
    ON "Embedding" USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- IVFFlat index as an alternative ANN index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embedding_ivfflat
    ON "Embedding" USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- AgentMemory
CREATE TABLE IF NOT EXISTS "AgentMemory" (
    "id"          UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"   TEXT         NOT NULL,
    "agent_id"    TEXT         NOT NULL,
    "key"         TEXT         NOT NULL,
    "value"       TEXT         NOT NULL,
    "memory_type" "MemoryType" NOT NULL DEFAULT 'SHORT_TERM',
    "expires_at"  TIMESTAMPTZ,
    "metadata"    JSONB,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentMemory_tenant_agent_key_key" ON "AgentMemory" ("tenant_id", "agent_id", "key");
CREATE INDEX IF NOT EXISTS "AgentMemory_tenant_id_agent_id_idx" ON "AgentMemory" ("tenant_id", "agent_id");
CREATE INDEX IF NOT EXISTS "AgentMemory_memory_type_idx"         ON "AgentMemory" ("memory_type");

-- ApiKey
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id"           UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id"    TEXT        NOT NULL,
    "name"         TEXT        NOT NULL,
    "key_hash"     TEXT        NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "expires_at"   TIMESTAMPTZ,
    "is_active"    BOOLEAN     NOT NULL DEFAULT true,
    "scopes"       TEXT[]      NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_key_hash_key" ON "ApiKey" ("key_hash");
CREATE INDEX IF NOT EXISTS "ApiKey_tenant_id_idx" ON "ApiKey" ("tenant_id");
