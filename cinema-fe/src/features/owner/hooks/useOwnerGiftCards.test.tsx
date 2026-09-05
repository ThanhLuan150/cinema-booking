import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerGiftCardsMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getOwnerGiftCards: (...args: unknown[]) => getOwnerGiftCardsMock(...args) }));

import { useOwnerGiftCards } from './useOwnerGiftCards';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerGiftCards', () => {
  beforeEach(() => getOwnerGiftCardsMock.mockReset());

  it("fetches the owner's gift cards for the given page/limit", async () => {
    getOwnerGiftCardsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerGiftCards(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerGiftCardsMock).toHaveBeenCalledWith(undefined, { page: 1, limit: 20 });
  });
});
