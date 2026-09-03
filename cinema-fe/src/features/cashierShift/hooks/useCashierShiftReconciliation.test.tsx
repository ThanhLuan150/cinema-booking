import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCashierShiftReconciliationMock = vi.fn();
vi.mock('../api/cashierShift.api', () => ({
  getCashierShiftReconciliation: (...args: unknown[]) => getCashierShiftReconciliationMock(...args),
}));

import { useCashierShiftReconciliation } from './useCashierShiftReconciliation';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCashierShiftReconciliation', () => {
  beforeEach(() => getCashierShiftReconciliationMock.mockReset());

  it('fetches the reconciliation for a given shift id', async () => {
    getCashierShiftReconciliationMock.mockResolvedValue({ shift: { id: 5 }, reconciliation: { expectedCash: 1 } });
    const { result } = renderHook(() => useCashierShiftReconciliation(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCashierShiftReconciliationMock).toHaveBeenCalledWith(5);
  });

  it('does not fetch while no shift id is set', () => {
    renderHook(() => useCashierShiftReconciliation(null), { wrapper });
    expect(getCashierShiftReconciliationMock).not.toHaveBeenCalled();
  });
});
