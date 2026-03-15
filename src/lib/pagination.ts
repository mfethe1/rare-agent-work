/**
 * Standardized pagination helper for all list endpoints.
 */

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Paginate an array of items.
 * @param items - Full list of items
 * @param offset - Starting index (0-based)
 * @param limit - Max items to return
 */
export function paginate<T>(
  items: T[],
  offset: number,
  limit: number,
): PaginatedResult<T> {
  const total = items.length;
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);
  const page = items.slice(safeOffset, safeOffset + safeLimit);

  return {
    items: page,
    pagination: {
      total,
      limit: safeLimit,
      offset: safeOffset,
      has_more: safeOffset + safeLimit < total,
    },
  };
}
