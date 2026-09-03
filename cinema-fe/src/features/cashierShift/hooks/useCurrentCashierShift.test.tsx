import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCurrentCashierShiftMock = vi.fn();
vi.mock('../api/cashierShift.api', () => ({
  getCurrentCashierShift: (...args: unknown[]) => getCurrentCashierShiftMock(...args),
}));

import { useCurrentCashierShift } from './useCurrentCashierShift';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCurrentCashierShift', () => {
  beforeEach(() => getCurrentCashierShiftMock.mockReset());

  it('fetches the caller’s current drawer when enabled', async () => {
    getCurrentCashierShiftMock.mockResolvedValue({ shift: { id: 1 }, reconciliation: { expectedCash: 100 } });
    const { result } = renderHook(() => useCurrentCashierShift(true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCurrentCashierShiftMock).toHaveBeenCalled();
    expect(result.current.data?.shift?.id).toBe(1);
  });

  it('does not fetch when disabled (no cashierShift.open permission)', () => {
    renderHook(() => useCurrentCashierShift(false), { wrapper });
    expect(getCurrentCashierShiftMock).not.toHaveBeenCalled();
  });
});
