import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerPricingRulesMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  getOwnerPricingRules: (...args: unknown[]) => getOwnerPricingRulesMock(...args),
}));

import { useOwnerPricingRules } from './useOwnerPricingRules';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerPricingRules', () => {
  beforeEach(() => getOwnerPricingRulesMock.mockReset());

  it("fetches the owner's pricing rules for the given branch/page/limit", async () => {
    getOwnerPricingRulesMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerPricingRules(1, 1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerPricingRulesMock).toHaveBeenCalledWith(1, { page: 1, limit: 20 });
  });
});
