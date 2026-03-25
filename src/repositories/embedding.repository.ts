/**
 * Embedding repository for @ascendstack/vectordb.
 * Provides vector insertion and cosine-similarity search via pgvector.
 * Uses Prisma.$queryRaw for HNSW/IVFFlat accelerated nearest-neighbor queries.
 * Hybrid search combines cosine similarity with PostgreSQL full-text search.
 */

import { Embedding } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult, SearchResult, VectorSearchParams, HybridSearchParams } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';
import { config } from '../config';

type EmbeddingCreateInput = Omit<Prisma.EmbeddingUncheckedCreateInput, 'tenant_id' | 'embedding'>;

/** Raw row returned by pgvector cosine search queries. */
interface RawSearchRow {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown> | null;
  document_id: string | null;
  chunk_index: number | null;
}

/** Repository for Embedding data access and vector search. */
export class EmbeddingRepository extends BaseRepository<
  Embedding,
  EmbeddingCreateInput,
  Prisma.EmbeddingUncheckedUpdateInput
> {
  /** Creates an embedding metadata record (without the vector). Use insertEmbedding for full insert. */
  async create(tenantId: string, data: EmbeddingCreateInput): Promise<Embedding> {
    return prisma.embedding.create({
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Finds an embedding by ID within the tenant scope. */
  async findById(tenantId: string, id: string): Promise<Embedding | null> {
    return prisma.embedding.findFirst({ where: { id, tenant_id: tenantId } });
  }

  /** Lists embedding records with pagination. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<Embedding>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.embedding.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.embedding.count({ where: { tenant_id: tenantId } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates an embedding record. */
  async update(
    tenantId: string,
    id: string,
    data: Prisma.EmbeddingUncheckedUpdateInput,
  ): Promise<Embedding> {
    return prisma.embedding.update({
      where: { id },
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Deletes an embedding record. */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.embedding.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /**
   * Inserts a new embedding record including the vector via a raw SQL upsert.
   * Uses the pgvector `::vector` cast so the float array is stored correctly.
   */
  async insertEmbedding(
    tenantId: string,
    data: EmbeddingCreateInput,
    embeddingVector: number[],
  ): Promise<Embedding> {
    const embeddingStr = `[${embeddingVector.join(',')}]`;
    const id = crypto.randomUUID();

    await prisma.$executeRaw`
      INSERT INTO "Embedding" (
        id, tenant_id, document_chunk_id, agent_memory_id,
        model, dimensions, embedding, created_at, updated_at
      ) VALUES (
        ${id}::uuid,
        ${tenantId},
        ${data.document_chunk_id ?? null}::uuid,
        ${data.agent_memory_id ?? null}::uuid,
        ${data.model ?? 'text-embedding-3-small'},
        ${data.dimensions ?? config.EMBEDDING_DIMENSIONS},
        ${embeddingStr}::vector,
        now(), now()
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const inserted = await prisma.embedding.findUniqueOrThrow({ where: { id } });
    return inserted;
  }

  /**
   * Performs a cosine similarity vector search using the pgvector <=> operator.
   * Uses the HNSW index created in the migration for sub-millisecond ANN search.
   */
  async rawVectorSearch(params: VectorSearchParams): Promise<SearchResult[]> {
    const { tenantId, embedding, topK = config.DEFAULT_TOP_K } = params;
    const embeddingStr = `[${embedding.join(',')}]`;

    const rows = await prisma.$queryRaw<RawSearchRow[]>`
      SELECT
        dc.id,
        1 - (e.embedding <=> ${embeddingStr}::vector) AS score,
        dc.content,
        dc.metadata,
        dc.document_id,
        dc.chunk_index
      FROM "Embedding" e
      JOIN "DocumentChunk" dc ON e.document_chunk_id = dc.id
      WHERE e.tenant_id = ${tenantId}
      ORDER BY e.embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

    return rows.map((row) => ({
      id: row.id,
      score: Number(row.score),
      content: row.content,
      metadata: row.metadata ?? undefined,
      documentId: row.document_id ?? undefined,
      chunkIndex: row.chunk_index ?? undefined,
    }));
  }

  /**
   * Hybrid search: blends cosine similarity with PostgreSQL full-text search.
   * vectorWeight controls the contribution of the vector score (0–1).
   */
  async hybridSearch(params: HybridSearchParams): Promise<SearchResult[]> {
    const { tenantId, embedding, query, topK = config.DEFAULT_TOP_K, vectorWeight = 0.7 } = params;
    const embeddingStr = `[${embedding.join(',')}]`;
    const keywordWeight = 1 - vectorWeight;

    const rows = await prisma.$queryRaw<RawSearchRow[]>`
      WITH vector_scores AS (
        SELECT
          dc.id,
          1 - (e.embedding <=> ${embeddingStr}::vector) AS vector_score,
          dc.content,
          dc.metadata,
          dc.document_id,
          dc.chunk_index
        FROM "Embedding" e
        JOIN "DocumentChunk" dc ON e.document_chunk_id = dc.id
        WHERE e.tenant_id = ${tenantId}
      ),
      keyword_scores AS (
        SELECT
          dc.id,
          ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', ${query})) AS keyword_score
        FROM "DocumentChunk" dc
        WHERE dc.tenant_id = ${tenantId}
      )
      SELECT
        vs.id,
        (${vectorWeight} * vs.vector_score + ${keywordWeight} * COALESCE(ks.keyword_score, 0)) AS score,
        vs.content,
        vs.metadata,
        vs.document_id,
        vs.chunk_index
      FROM vector_scores vs
      LEFT JOIN keyword_scores ks ON vs.id = ks.id
      ORDER BY score DESC
      LIMIT ${topK}
    `;

    return rows.map((row) => ({
      id: row.id,
      score: Number(row.score),
      content: row.content,
      metadata: row.metadata ?? undefined,
      documentId: row.document_id ?? undefined,
      chunkIndex: row.chunk_index ?? undefined,
    }));
  }

  /** Finds the embedding record associated with a specific document chunk. */
  async findByChunkId(tenantId: string, chunkId: string): Promise<Embedding | null> {
    return prisma.embedding.findFirst({
      where: { tenant_id: tenantId, document_chunk_id: chunkId },
    });
  }
}

export const embeddingRepository = new EmbeddingRepository();
