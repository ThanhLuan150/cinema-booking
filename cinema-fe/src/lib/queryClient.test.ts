import { describe, expect, it } from 'vitest';
import { queryClient } from './queryClient';

describe('queryClient', () => {
  it('configures a 60s stale time and disables refetch on window focus', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(60 * 1000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });
});
