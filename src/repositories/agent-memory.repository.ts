/**
 * AgentMemory repository for @ascendstack/vectordb.
 * Manages short-term and long-term memory entries for AI agents.
 * Supports upsert-based memory storage, semantic vector search, and TTL expiry.
 */

import { AgentMemory, MemoryType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PaginationParams, PaginatedResult, SearchResult, VectorSearchParams } from '../types';
import { BaseRepository } from './base.repository';
import { buildPaginatedResult } from '../utils/pagination';
import { config } from '../config';

type MemoryCreateInput = Omit<Prisma.AgentMemoryUncheckedCreateInput, 'tenant_id'>;
type MemoryUpdateInput = Prisma.AgentMemoryUncheckedUpdateInput;

/** Raw row returned by agent memory vector search. */
interface RawMemorySearchRow {
  id: string;
  score: number;
  value: string;
  key: string;
  metadata: Record<string, unknown> | null;
}

/** Repository for AgentMemory data access. */
export class AgentMemoryRepository extends BaseRepository<AgentMemory, MemoryCreateInput, MemoryUpdateInput> {
  /** Creates a new memory entry. */
  async create(tenantId: string, data: MemoryCreateInput): Promise<AgentMemory> {
    return prisma.agentMemory.create({
      data: { ...data, tenant_id: tenantId },
    });
  }

  /** Finds a memory entry by ID. */
  async findById(tenantId: string, id: string): Promise<AgentMemory | null> {
    return prisma.agentMemory.findFirst({ where: { id, tenant_id: tenantId } });
  }

  /** Lists memory entries for a tenant with pagination. */
  async list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<AgentMemory>> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.agentMemory.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.agentMemory.count({ where: { tenant_id: tenantId } }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /** Updates a memory entry. */
  async update(tenantId: string, id: string, data: MemoryUpdateInput): Promise<AgentMemory> {
    await prisma.agentMemory.updateMany({
      where: { id, tenant_id: tenantId },
      data: { ...data, tenant_id: tenantId },
    });
    const updated = await prisma.agentMemory.findFirst({ where: { id, tenant_id: tenantId } });
    if (!updated) throw new Error('AgentMemory not found');
    return updated;
  }

  /** Deletes a memory entry by ID. */
  async delete(tenantId: string, id: string): Promise<void> {
    await prisma.agentMemory.deleteMany({ where: { id, tenant_id: tenantId } });
  }

  /** Returns all memory entries for a specific agent. */
  async findByAgentId(tenantId: string, agentId: string): Promise<AgentMemory[]> {
    return prisma.agentMemory.findMany({
      where: { tenant_id: tenantId, agent_id: agentId },
      orderBy: { updated_at: 'desc' },
    });
  }

  /**
   * Upserts a memory entry by (tenant_id, agent_id, key).
   * Creates a new record if none exists; updates value if it does.
   */
  async upsertMemory(
    tenantId: string,
    agentId: string,
    key: string,
    value: string,
    memoryType: MemoryType = 'SHORT_TERM',
    expiresAt?: Date,
    metadata?: Record<string, unknown>,
  ): Promise<AgentMemory> {
    return prisma.agentMemory.upsert({
      where: { tenant_id_agent_id_key: { tenant_id: tenantId, agent_id: agentId, key } },
      create: {
        tenant_id: tenantId,
        agent_id: agentId,
        key,
        value,
        memory_type: memoryType,
        expires_at: expiresAt,
        metadata: metadata as Prisma.InputJsonValue,
      },
      update: {
        value,
        memory_type: memoryType,
        expires_at: expiresAt,
        metadata: metadata as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Semantic vector search over agent memory embeddings for a given agent.
   */
  async searchByVector(
    params: VectorSearchParams,
    agentId: string,
  ): Promise<SearchResult[]> {
    const { tenantId, embedding, topK = config.DEFAULT_TOP_K } = params;
    const embeddingStr = `[${embedding.join(',')}]`;

    const rows = await prisma.$queryRaw<RawMemorySearchRow[]>`
      SELECT
        am.id,
        1 - (e.embedding <=> ${embeddingStr}::vector) AS score,
        am.value,
        am.key,
        am.metadata
      FROM "Embedding" e
      JOIN "AgentMemory" am ON e.agent_memory_id = am.id
      WHERE e.tenant_id = ${tenantId}
        AND am.agent_id = ${agentId}
        AND (am.expires_at IS NULL OR am.expires_at > now())
      ORDER BY e.embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

    return rows.map((row) => ({
      id: row.id,
      score: Number(row.score),
      content: row.value,
      metadata: row.metadata ?? undefined,
    }));
  }

  /**
   * Deletes expired memory entries (where expires_at < now()).
   * Returns the count of deleted records.
   */
  async expireOldMemories(tenantId: string): Promise<number> {
    const result = await prisma.agentMemory.deleteMany({
      where: {
        tenant_id: tenantId,
        expires_at: { lt: new Date() },
      },
    });
    return result.count;
  }

  /** Deletes a specific memory entry by agent and key. */
  async deleteByAgentKey(tenantId: string, agentId: string, key: string): Promise<void> {
    await prisma.agentMemory.deleteMany({
      where: { tenant_id: tenantId, agent_id: agentId, key },
    });
  }
}

export const agentMemoryRepository = new AgentMemoryRepository();
