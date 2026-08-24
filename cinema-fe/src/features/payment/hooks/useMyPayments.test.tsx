import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyPaymentsMock = vi.fn();
vi.mock('../api/payment.api', () => ({ getMyPayments: (...args: unknown[]) => getMyPaymentsMock(...args) }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useMyPayments } from './useMyPayments';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyPayments', () => {
  beforeEach(() => {
    getMyPaymentsMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('fetches payments for the given page/limit when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getMyPaymentsMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useMyPayments(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyPaymentsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('does not fetch when the user is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    renderHook(() => useMyPayments(1, 20), { wrapper });
    expect(getMyPaymentsMock).not.toHaveBeenCalled();
  });
});
