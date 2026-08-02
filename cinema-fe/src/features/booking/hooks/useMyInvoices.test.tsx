import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyInvoicesMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getMyInvoices: () => getMyInvoicesMock() }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useMyInvoices } from './useMyInvoices';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyInvoices', () => {
  beforeEach(() => {
    getMyInvoicesMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when the caller is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useMyInvoices(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches invoices when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getMyInvoicesMock.mockResolvedValue([{ id: 1 }]);
    const { result } = renderHook(() => useMyInvoices(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyInvoicesMock).toHaveBeenCalled();
  });
});
