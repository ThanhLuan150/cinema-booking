import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const requestPaymentRefundMock = vi.fn();
vi.mock('../api/payment.api', () => ({
  requestPaymentRefund: (...args: unknown[]) => requestPaymentRefundMock(...args),
}));

import { useRequestPaymentRefund } from './useRequestPaymentRefund';
import { adminPaymentsQueryKey } from './useAdminPayments';

describe('useRequestPaymentRefund', () => {
  beforeEach(() => requestPaymentRefundMock.mockReset());

  it('calls requestPaymentRefund and invalidates adminPayments', async () => {
    requestPaymentRefundMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useRequestPaymentRefund(), { wrapper });
    result.current.mutate({ id: 5, reason: 'Customer request' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestPaymentRefundMock).toHaveBeenCalledWith(5, 'Customer request');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminPaymentsQueryKey });
  });
});
