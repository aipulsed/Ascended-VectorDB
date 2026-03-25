-- Initialisation script for PostgreSQL in the @ascendstack/vectordb Docker environment.
-- Ensures the pgvector extension is available before Prisma migrations run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
