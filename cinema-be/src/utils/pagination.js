const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginatedResult({ data, total, page, limit }) {
  return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { parsePagination, buildPaginatedResult, DEFAULT_LIMIT, MAX_LIMIT };
