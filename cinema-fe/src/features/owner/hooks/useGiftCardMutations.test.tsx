import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createGiftCardMock = vi.fn();
const blockGiftCardMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createGiftCard: (...args: unknown[]) => createGiftCardMock(...args),
  blockGiftCard: (...args: unknown[]) => blockGiftCardMock(...args),
}));

import { useCreateGiftCard, useBlockGiftCard } from './useGiftCardMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('gift card mutation hooks', () => {
  beforeEach(() => {
    createGiftCardMock.mockReset();
    blockGiftCardMock.mockReset();
  });

  it('useCreateGiftCard coerces initial_balance and invalidates ownerGiftCards', async () => {
    createGiftCardMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateGiftCard(), { wrapper });
    result.current.mutate({
      cinema_id: '1',
      code: 'GC100',
      initial_balance: '100000',
      currency: 'VND',
      expires_at: '',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createGiftCardMock).toHaveBeenCalledWith({
      cinema_id: '1',
      code: 'GC100',
      initial_balance: 100000,
      currency: 'VND',
      expires_at: '',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerGiftCards'] });
  });

  it('useBlockGiftCard blocks and invalidates ownerGiftCards', async () => {
    blockGiftCardMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useBlockGiftCard(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(blockGiftCardMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerGiftCards'] });
  });
});
