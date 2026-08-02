const { parsePagination, buildPaginatedResult, DEFAULT_LIMIT, MAX_LIMIT } = require('./pagination');

describe('parsePagination', () => {
  it('defaults to page 1 and the default limit when the query is empty', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });

  it('parses page and limit from query strings', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('clamps page below 1 up to 1', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-5' }).page).toBe(1);
  });

  it('clamps limit above MAX_LIMIT down to MAX_LIMIT', () => {
    expect(parsePagination({ limit: '1000' }).limit).toBe(MAX_LIMIT);
  });

  it('falls back to the default limit when limit is 0 (falsy)', () => {
    expect(parsePagination({ limit: '0' }).limit).toBe(DEFAULT_LIMIT);
  });

  it('clamps a negative limit up to 1', () => {
    expect(parsePagination({ limit: '-5' }).limit).toBe(1);
  });

  it('falls back to defaults for non-numeric input', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
  });
});

describe('buildPaginatedResult', () => {
  it('builds a result object with computed totalPages', () => {
    const result = buildPaginatedResult({ data: [1, 2], total: 25, page: 2, limit: 10 });
    expect(result).toEqual({ data: [1, 2], total: 25, page: 2, limit: 10, totalPages: 3 });
  });

  it('returns at least 1 total page even when total is 0', () => {
    const result = buildPaginatedResult({ data: [], total: 0, page: 1, limit: 10 });
    expect(result.totalPages).toBe(1);
  });
});
