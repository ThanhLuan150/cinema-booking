import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const closeCashierShiftMock = vi.fn();
vi.mock('../api/cashierShift.api', () => ({
  closeCashierShift: (...args: unknown[]) => closeCashierShiftMock(...args),
}));

import { useCloseCashierShift } from './useCloseCashierShift';

describe('useCloseCashierShift', () => {
  beforeEach(() => closeCashierShiftMock.mockReset());

  it('closes the shift by id and invalidates the current-shift and list queries', async () => {
    closeCashierShiftMock.mockResolvedValue({ id: 1, status: 'CLOSED', difference: -10000 });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useCloseCashierShift(), { wrapper });
    result.current.mutate({ id: 1, payload: { actual_cash: 1040000 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(closeCashierShiftMock).toHaveBeenCalledWith(1, { actual_cash: 1040000 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cashierShifts', 'current'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cashierShifts'] });
  });
});
