import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const cancelInvoiceMock = vi.fn();
vi.mock('../api/booking.api', () => ({ cancelInvoice: (...args: unknown[]) => cancelInvoiceMock(...args) }));

import { useCancelInvoice } from './useCancelInvoice';

describe('useCancelInvoice', () => {
  beforeEach(() => cancelInvoiceMock.mockReset());

  it('cancels the invoice and invalidates the my-invoices query', async () => {
    cancelInvoiceMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useCancelInvoice(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelInvoiceMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myInvoices'] });
  });
});
