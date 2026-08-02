import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats a number as VND currency using the vi locale', () => {
    const result = formatCurrency(100000, 'vi');
    expect(result).toContain('100.000');
    expect(result).toMatch(/₫/);
  });

  it('formats a number as VND currency using the en locale', () => {
    const result = formatCurrency(100000, 'en');
    expect(result).toContain('100,000');
  });

  it('falls back to the vi locale for an unknown language', () => {
    const result = formatCurrency(50000, 'xx');
    expect(result).toContain('50.000');
  });
});

describe('formatDate', () => {
  it('formats a date string using the vi locale', () => {
    const result = formatDate('2026-01-15', 'vi');
    expect(result).toContain('2026');
  });

  it('formats a date using the en locale', () => {
    const result = formatDate('2026-01-15', 'en');
    expect(result).toContain('2026');
  });

  it('accepts a Date instance', () => {
    const result = formatDate(new Date('2026-03-01'), 'en');
    expect(result).toContain('2026');
  });
});
