import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const validateGiftCardMock = vi.fn();
vi.mock('../api/giftCard.api', () => ({ validateGiftCard: (...args: unknown[]) => validateGiftCardMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useValidateGiftCard } from './useValidateGiftCard';

describe('useValidateGiftCard', () => {
  beforeEach(() => validateGiftCardMock.mockReset());

  it('calls validateGiftCard with code and orderValue', async () => {
    validateGiftCardMock.mockResolvedValue({ applicable_amount: 50000 });
    const { result } = renderHook(() => useValidateGiftCard(), { wrapper });
    result.current.mutate({ code: 'GC1', orderValue: 100000 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(validateGiftCardMock).toHaveBeenCalledWith('GC1', 100000);
  });
});
