/**
 * Application configuration module for @ascendstack/vectordb.
 * Validates all required environment variables using Zod and exports
 * a typed, immutable config object consumed throughout the application.
 */

import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  REDIS_URL: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  DEFAULT_TOP_K: z.coerce.number().int().positive().default(10),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

/** Validated, typed application configuration. */
export const config = Object.freeze(parsed.data);

export type Config = typeof config;
