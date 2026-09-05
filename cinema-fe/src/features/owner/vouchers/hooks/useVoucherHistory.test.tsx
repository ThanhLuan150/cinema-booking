import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getVoucherHistoryMock = vi.fn();
vi.mock('../../api/owner.api', () => ({ getVoucherHistory: (...args: unknown[]) => getVoucherHistoryMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useVoucherHistory } from './useVoucherHistory';

describe('useVoucherHistory', () => {
  beforeEach(() => getVoucherHistoryMock.mockReset());

  it('fetches history for a given voucher id', async () => {
    getVoucherHistoryMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useVoucherHistory(1, 1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getVoucherHistoryMock).toHaveBeenCalledWith(1, { page: 1, limit: 20 });
  });

  it('does not fetch when voucherId is null', () => {
    const { result } = renderHook(() => useVoucherHistory(null, 1, 20), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getVoucherHistoryMock).not.toHaveBeenCalled();
  });
});
