import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getGiftCardHistoryMock = vi.fn();
vi.mock('../api/giftCard.api', () => ({ getGiftCardHistory: (...args: unknown[]) => getGiftCardHistoryMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useGiftCardHistory } from './useGiftCardHistory';

describe('useGiftCardHistory', () => {
  beforeEach(() => getGiftCardHistoryMock.mockReset());

  it('fetches history for a given gift card id', async () => {
    getGiftCardHistoryMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useGiftCardHistory(1, 1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getGiftCardHistoryMock).toHaveBeenCalledWith(1, 1, 20);
  });

  it('does not fetch when giftCardId is null', () => {
    const { result } = renderHook(() => useGiftCardHistory(null, 1, 20), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getGiftCardHistoryMock).not.toHaveBeenCalled();
  });
});
