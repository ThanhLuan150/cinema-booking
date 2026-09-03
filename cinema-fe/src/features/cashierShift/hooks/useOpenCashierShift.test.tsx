import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const openCashierShiftMock = vi.fn();
vi.mock('../api/cashierShift.api', () => ({
  openCashierShift: (...args: unknown[]) => openCashierShiftMock(...args),
}));

import { useOpenCashierShift } from './useOpenCashierShift';

describe('useOpenCashierShift', () => {
  beforeEach(() => openCashierShiftMock.mockReset());

  it('opens a shift and invalidates the current-shift and list queries', async () => {
    openCashierShiftMock.mockResolvedValue({ id: 1, status: 'OPEN' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useOpenCashierShift(), { wrapper });
    result.current.mutate({ branch_id: 1, opening_cash: 500000 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(openCashierShiftMock).toHaveBeenCalledWith({ branch_id: 1, opening_cash: 500000 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cashierShifts', 'current'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cashierShifts'] });
  });
});
