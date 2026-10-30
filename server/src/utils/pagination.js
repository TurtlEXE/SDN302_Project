/**
 * Pagination helper for MongoDB queries and API responses
 */

/**
 * Parses and validates pagination parameters from query string
 * @param {object} query
 * @param {number} [defaultLimit=10]
 * @param {number} [maxLimit=100]
 * @returns {{ page: number, limit: number, skip: number }}
 */
export function parsePagination(query = {}, defaultLimit = 10, maxLimit = 100) {
  let defLimit = defaultLimit;
  let mxLimit = maxLimit;
  if (typeof defaultLimit === 'object' && defaultLimit !== null) {
    defLimit = defaultLimit.defaultLimit || 10;
    mxLimit = defaultLimit.maxLimit || 100;
  }

  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defLimit;
  } else if (limit > mxLimit) {
    limit = mxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Formats data and pagination metadata into standardized response structure
 * @param {Array} items
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 * @returns {{ items: Array, pagination: { page: number, limit: number, total: number, totalPages: number } }}
 */
export function formatPaginatedResponse(items = [], total = 0, page = 1, limit = 10) {
  const safeTotal = Math.max(0, total);
  const totalPages = Math.ceil(safeTotal / limit) || 1;

  return {
    items,
    pagination: {
      page,
      limit,
      total: safeTotal,
      totalPages,
    },
  };
}

/**
 * Escapes regex special characters to prevent ReDoS attacks in search queries
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  parsePagination,
  formatPaginatedResponse,
  escapeRegex,
};

