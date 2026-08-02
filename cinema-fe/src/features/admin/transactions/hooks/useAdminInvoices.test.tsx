import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAdminInvoicesMock = vi.fn();
vi.mock('../api/transactions.api', () => ({ getAdminInvoices: (...args: unknown[]) => getAdminInvoicesMock(...args) }));

import { useAdminInvoices } from './useAdminInvoices';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAdminInvoices', () => {
  beforeEach(() => getAdminInvoicesMock.mockReset());

  it('fetches invoices for the given page/limit', async () => {
    getAdminInvoicesMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useAdminInvoices(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAdminInvoicesMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
