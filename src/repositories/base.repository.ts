/**
 * Abstract base repository for @ascendstack/vectordb.
 * All concrete repositories extend this class to inherit standard CRUD operations
 * with built-in tenant isolation. Every operation requires a tenantId to enforce
 * multi-tenancy at the data layer.
 */

import { PaginationParams, PaginatedResult } from '../types';

/**
 * Abstract base repository defining the contract for all data access objects.
 * @template T  The Prisma model type this repository manages.
 * @template CreateInput  The Prisma CreateInput type for this model.
 * @template UpdateInput  The Prisma UpdateInput type for this model.
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  /**
   * Creates a new record scoped to the given tenant.
   */
  abstract create(tenantId: string, data: CreateInput): Promise<T>;

  /**
   * Finds a single record by ID within the tenant scope.
   * Returns null if not found.
   */
  abstract findById(tenantId: string, id: string): Promise<T | null>;

  /**
   * Lists records for the tenant with pagination.
   */
  abstract list(tenantId: string, params: PaginationParams): Promise<PaginatedResult<T>>;

  /**
   * Updates an existing record scoped to the given tenant.
   */
  abstract update(tenantId: string, id: string, data: UpdateInput): Promise<T>;

  /**
   * Deletes a record scoped to the given tenant.
   */
  abstract delete(tenantId: string, id: string): Promise<void>;
}
