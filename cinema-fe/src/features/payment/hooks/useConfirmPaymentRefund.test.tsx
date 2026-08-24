import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const confirmPaymentRefundMock = vi.fn();
vi.mock('../api/payment.api', () => ({
  confirmPaymentRefund: (...args: unknown[]) => confirmPaymentRefundMock(...args),
}));

import { useConfirmPaymentRefund } from './useConfirmPaymentRefund';
import { adminPaymentsQueryKey } from './useAdminPayments';

describe('useConfirmPaymentRefund', () => {
  beforeEach(() => confirmPaymentRefundMock.mockReset());

  it('calls confirmPaymentRefund and invalidates adminPayments', async () => {
    confirmPaymentRefundMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useConfirmPaymentRefund(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(confirmPaymentRefundMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminPaymentsQueryKey });
  });
});
