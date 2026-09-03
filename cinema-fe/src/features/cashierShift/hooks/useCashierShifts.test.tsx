import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCashierShiftsMock = vi.fn();
vi.mock('../api/cashierShift.api', () => ({
  getCashierShifts: (...args: unknown[]) => getCashierShiftsMock(...args),
}));

import { useCashierShifts } from './useCashierShifts';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCashierShifts', () => {
  beforeEach(() => getCashierShiftsMock.mockReset());

  it('forwards the params and returns the paginated result', async () => {
    getCashierShiftsMock.mockResolvedValue({ data: [{ id: 1 }], total: 1, page: 1, limit: 10, totalPages: 1 });
    const { result } = renderHook(() => useCashierShifts({ page: 1, limit: 10, status: 'OPEN' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCashierShiftsMock).toHaveBeenCalledWith({ page: 1, limit: 10, status: 'OPEN' });
    expect(result.current.data?.data).toEqual([{ id: 1 }]);
  });
});
