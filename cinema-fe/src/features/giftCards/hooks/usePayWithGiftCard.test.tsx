import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const payWithGiftCardMock = vi.fn();
vi.mock('../api/giftCard.api', () => ({ payWithGiftCard: (...args: unknown[]) => payWithGiftCardMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { usePayWithGiftCard } from './usePayWithGiftCard';

describe('usePayWithGiftCard', () => {
  beforeEach(() => payWithGiftCardMock.mockReset());

  it('calls payWithGiftCard with the payload and idempotency key', async () => {
    payWithGiftCardMock.mockResolvedValue({ bookingId: 1, totalPrice: 100000 });
    const payload = { code: 'GC1', ticketIds: [1, 2], comboIds: [] };
    const { result } = renderHook(() => usePayWithGiftCard(), { wrapper });
    result.current.mutate({ payload, idempotencyKey: 'key-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(payWithGiftCardMock).toHaveBeenCalledWith(payload, 'key-1');
  });
});
