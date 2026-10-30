import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePagination,
  formatPaginatedResponse,
  escapeRegex,
} from '../../src/utils/pagination.js';

describe('Pagination Utility (Unit)', () => {
  it('should parse valid pagination parameters with custom defaults and bounds', () => {
    const res1 = parsePagination({ page: '2', limit: '20' });
    assert.equal(res1.page, 2);
    assert.equal(res1.limit, 20);
    assert.equal(res1.skip, 20);

    // Default parameters
    const res2 = parsePagination({});
    assert.equal(res2.page, 1);
    assert.equal(res2.limit, 10);
    assert.equal(res2.skip, 0);

    // Invalid parameters fallback to defaults
    const res3 = parsePagination({ page: '-5', limit: 'abc' });
    assert.equal(res3.page, 1);
    assert.equal(res3.limit, 10);
    assert.equal(res3.skip, 0);

    // Max limit constraint
    const res4 = parsePagination({ page: '1', limit: '500' }, 10, 50);
    assert.equal(res4.limit, 50);
  });

  it('should format paginated response structure correctly', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const formatted = formatPaginatedResponse(items, 25, 2, 10);

    assert.deepEqual(formatted.items, items);
    assert.equal(formatted.pagination.page, 2);
    assert.equal(formatted.pagination.limit, 10);
    assert.equal(formatted.pagination.total, 25);
    assert.equal(formatted.pagination.totalPages, 3);

    // 0 total items
    const emptyFormatted = formatPaginatedResponse([], 0, 1, 10);
    assert.equal(emptyFormatted.pagination.total, 0);
    assert.equal(emptyFormatted.pagination.totalPages, 1);
  });

  it('should escape regex special characters to prevent ReDoS attacks', () => {
    const raw = 'test(string)[with].*special+chars?^${}|\\';
    const escaped = escapeRegex(raw);

    assert.equal(escaped, 'test\\(string\\)\\[with\\]\\.\\*special\\+chars\\?\\^\\$\\{\\}\\|\\\\');
    const regex = new RegExp(escaped);
    assert.ok(regex.test(raw));
  });
});

