import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const redeemGiftCardMock = vi.fn();
vi.mock('../api/giftCard.api', () => ({ redeemGiftCard: (...args: unknown[]) => redeemGiftCardMock(...args) }));

import { useRedeemGiftCard } from './useRedeemGiftCard';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('useRedeemGiftCard', () => {
  beforeEach(() => redeemGiftCardMock.mockReset());

  it('redeems the code and invalidates myGiftCards', async () => {
    redeemGiftCardMock.mockResolvedValue({ id: 1, code: 'GC1' });
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRedeemGiftCard(), { wrapper });
    result.current.mutate('GC1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(redeemGiftCardMock).toHaveBeenCalledWith('GC1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myGiftCards'] });
  });
});
