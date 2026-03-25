/**
 * Redis cache helpers for @ascendstack/vectordb.
 * Thin wrappers around ioredis for get/set/delete/clear operations.
 * All operations degrade gracefully when Redis is unavailable.
 */

import { getRedisClient } from '../lib/redis';
import { logger } from '../lib/logger';
import { config } from '../config';

/**
 * Retrieves a cached value and deserialises it from JSON.
 * Returns null if the key doesn't exist or Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.warn('Cache get error', { key, error });
    return null;
  }
}

/**
 * Serialises a value to JSON and stores it with an optional TTL.
 * Falls back silently when Redis is unavailable.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const serialised = JSON.stringify(value);
    const ttl = ttlSeconds ?? config.CACHE_TTL_SECONDS;
    await redis.setex(key, ttl, serialised);
  } catch (error) {
    logger.warn('Cache set error', { key, error });
  }
}

/**
 * Deletes a specific cache key.
 */
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    logger.warn('Cache delete error', { key, error });
  }
}

/**
 * Deletes all cache keys matching the given pattern (e.g. "tenant:abc:*").
 * Uses SCAN to avoid blocking the Redis event loop.
 */
export async function cacheClear(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, found] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.warn('Cache clear error', { pattern, error });
  }
}
