/**
 * ioredis client singleton for @ascendstack/vectordb.
 * Provides a lazy-connecting Redis client with graceful error handling.
 * Returns null if REDIS_URL is not configured so the app degrades gracefully.
 */

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redisClient: Redis | null = null;

/**
 * Returns the shared Redis client instance, creating it on first call.
 * Returns null if REDIS_URL is not configured.
 */
export function getRedisClient(): Redis | null {
  if (!config.REDIS_URL) return null;

  if (redisClient) return redisClient;

  redisClient = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected');
  });

  redisClient.on('error', (err: Error) => {
    logger.error('Redis connection error', { error: err.message });
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redisClient;
}

/**
 * Gracefully disconnects the Redis client if it is connected.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}
