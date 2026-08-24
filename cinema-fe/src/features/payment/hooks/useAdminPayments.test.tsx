import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAdminPaymentsMock = vi.fn();
vi.mock('../api/payment.api', () => ({ getAdminPayments: (...args: unknown[]) => getAdminPaymentsMock(...args) }));

import { useAdminPayments } from './useAdminPayments';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAdminPayments', () => {
  beforeEach(() => getAdminPaymentsMock.mockReset());

  it('fetches payments for the given params', async () => {
    getAdminPaymentsMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useAdminPayments({ page: 1, limit: 20 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAdminPaymentsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
