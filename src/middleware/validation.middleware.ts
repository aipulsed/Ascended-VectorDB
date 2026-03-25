/**
 * Zod request validation middleware for @ascendstack/vectordb.
 * Provides factory functions that validate request body, query, and params
 * against Zod schemas, returning 400 on failure.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Creates an Express middleware that validates req.body against the given Zod schema.
 * Attaches the parsed, typed value back to req.body on success.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: (result.error as ZodError).flatten(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Creates an Express middleware that validates req.query against the given Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: (result.error as ZodError).flatten(),
      });
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };
}

/**
 * Creates an Express middleware that validates req.params against the given Zod schema.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: (result.error as ZodError).flatten(),
      });
      return;
    }
    req.params = result.data as typeof req.params;
    next();
  };
}
