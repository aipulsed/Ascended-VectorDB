/**
 * Pagination utility for @ascendstack/vectordb.
 * Builds the standard PaginatedResult envelope from raw query output.
 */

import { PaginatedResult } from '../types';

/** Wraps a data array and total count into the standard paginated result shape. */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}
