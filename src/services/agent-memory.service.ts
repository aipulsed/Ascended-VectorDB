/**
 * Agent memory service for @ascendstack/vectordb.
 * Provides high-level memory management for AI agents including key/value storage,
 * semantic recall via vector similarity, and TTL-based expiry pruning.
 */

import { AgentMemory, MemoryType } from '@prisma/client';
import { agentMemoryRepository } from '../repositories/agent-memory.repository';
import { logger } from '../lib/logger';
import { SearchResult, VectorSearchParams } from '../types';

export interface StoreMemoryInput {
  agentId: string;
  key: string;
  value: string;
  memoryType?: MemoryType;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

/** Service for AI agent memory operations. */
export class AgentMemoryService {
  /**
   * Stores or updates a memory entry for an agent.
   * If ttlSeconds is provided, the memory will expire after that duration.
   */
  async storeMemory(tenantId: string, input: StoreMemoryInput): Promise<AgentMemory> {
    try {
      const expiresAt = input.ttlSeconds
        ? new Date(Date.now() + input.ttlSeconds * 1000)
        : undefined;

      const memory = await agentMemoryRepository.upsertMemory(
        tenantId,
        input.agentId,
        input.key,
        input.value,
        input.memoryType ?? 'SHORT_TERM',
        expiresAt,
        input.metadata,
      );

      logger.info('Memory stored', { tenantId, agentId: input.agentId, key: input.key });
      return memory;
    } catch (error) {
      logger.error('Failed to store memory', { tenantId, agentId: input.agentId, error });
      throw error;
    }
  }

  /**
   * Recalls all non-expired memory entries for an agent.
   */
  async recallMemory(tenantId: string, agentId: string): Promise<AgentMemory[]> {
    try {
      const memories = await agentMemoryRepository.findByAgentId(tenantId, agentId);
      return memories.filter((m) => !m.expires_at || m.expires_at > new Date());
    } catch (error) {
      logger.error('Failed to recall memory', { tenantId, agentId, error });
      throw error;
    }
  }

  /**
   * Performs semantic recall using cosine similarity over memory embeddings.
   */
  async recallSemantic(tenantId: string, agentId: string, params: VectorSearchParams): Promise<SearchResult[]> {
    try {
      return await agentMemoryRepository.searchByVector(params, agentId);
    } catch (error) {
      logger.error('Semantic memory recall failed', { tenantId, agentId, error });
      throw error;
    }
  }

  /**
   * Deletes a specific memory entry by key.
   */
  async forgetMemory(tenantId: string, agentId: string, key: string): Promise<void> {
    try {
      await agentMemoryRepository.deleteByAgentKey(tenantId, agentId, key);
      logger.info('Memory forgotten', { tenantId, agentId, key });
    } catch (error) {
      logger.error('Failed to forget memory', { tenantId, agentId, key, error });
      throw error;
    }
  }

  /**
   * Prunes all expired memory entries for a tenant.
   * Returns the count of deleted entries.
   */
  async pruneExpiredMemories(tenantId: string): Promise<number> {
    try {
      const count = await agentMemoryRepository.expireOldMemories(tenantId);
      logger.info('Expired memories pruned', { tenantId, count });
      return count;
    } catch (error) {
      logger.error('Failed to prune expired memories', { tenantId, error });
      throw error;
    }
  }
}

export const agentMemoryService = new AgentMemoryService();
