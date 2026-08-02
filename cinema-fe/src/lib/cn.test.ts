import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins multiple class name strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('omits falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('returns an empty string when given nothing truthy', () => {
    expect(cn(false, undefined, null)).toBe('');
  });
});
