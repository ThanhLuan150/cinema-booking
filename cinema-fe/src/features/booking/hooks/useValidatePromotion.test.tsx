import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const validatePromotionMock = vi.fn();
vi.mock('../api/booking.api', () => ({ validatePromotion: (...args: unknown[]) => validatePromotionMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useValidatePromotion } from './useValidatePromotion';

describe('useValidatePromotion', () => {
  beforeEach(() => validatePromotionMock.mockReset());

  it('calls validatePromotion with the payload', async () => {
    validatePromotionMock.mockResolvedValue({ discount_amount: 1000 });
    const payload = { code: 'PROMO10', order_value: 100000 } as any;
    const { result } = renderHook(() => useValidatePromotion(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(validatePromotionMock).toHaveBeenCalledWith(payload);
  });
});
