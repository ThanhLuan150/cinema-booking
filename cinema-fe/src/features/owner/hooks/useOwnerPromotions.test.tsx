import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerPromotionsMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  getOwnerPromotions: (...args: unknown[]) => getOwnerPromotionsMock(...args),
}));

import { useOwnerPromotions } from './useOwnerPromotions';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerPromotions', () => {
  beforeEach(() => getOwnerPromotionsMock.mockReset());

  it("fetches the owner's promotions for the given branch/page/limit", async () => {
    getOwnerPromotionsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerPromotions(1, 1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerPromotionsMock).toHaveBeenCalledWith(1, { page: 1, limit: 20 });
  });
});
