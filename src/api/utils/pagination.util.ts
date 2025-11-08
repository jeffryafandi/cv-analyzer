/**
 * Global pagination utility functions
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Parse pagination parameters from query string
 * @param query - Query parameters object
 * @param defaultLimit - Default limit if not provided (default: 10)
 * @returns Parsed pagination parameters
 */
export function parsePaginationParams(
  query: Record<string, string | undefined>,
  defaultLimit: number = 10
): PaginationParams {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.max(
    1,
    Math.min(100, parseInt(query.limit as string) || defaultLimit)
  );

  return { page, limit };
}

/**
 * Calculate pagination metadata
 * @param total - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination result object
 */
export function calculatePagination(
  total: number,
  page: number,
  limit: number
): PaginationResult {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create pagination response helper
 * @param data - Array of data items
 * @param total - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Object with data and pagination metadata
 */
export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): {
  data: T[];
  pagination: PaginationResult;
} {
  return {
    data,
    pagination: calculatePagination(total, page, limit),
  };
}
