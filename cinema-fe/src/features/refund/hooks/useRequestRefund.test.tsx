import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const requestRefundMock = vi.fn();
vi.mock('../api/refund.api', () => ({ requestRefund: (...args: unknown[]) => requestRefundMock(...args) }));

import { useRequestRefund } from './useRequestRefund';

describe('useRequestRefund', () => {
  beforeEach(() => requestRefundMock.mockReset());

  it('requests a refund and invalidates myRefunds and bookings queries', async () => {
    requestRefundMock.mockResolvedValue({ id: 1, status: 'REQUESTED' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useRequestRefund(), { wrapper });
    result.current.mutate({ bookingId: 5, reason: 'change of plans' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestRefundMock).toHaveBeenCalledWith(5, 'change of plans');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myRefunds'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
  });
});
