import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const refundInvoiceMock = vi.fn();
vi.mock('../api/transactions.api', () => ({ refundInvoice: (...args: unknown[]) => refundInvoiceMock(...args) }));

import { useRefundInvoice } from './useRefundInvoice';

describe('useRefundInvoice', () => {
  beforeEach(() => refundInvoiceMock.mockReset());

  it('calls refundInvoice and invalidates adminInvoices', async () => {
    refundInvoiceMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useRefundInvoice(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(refundInvoiceMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminInvoices'] });
  });
});
