import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getShiftsMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getShifts: (...args: unknown[]) => getShiftsMock(...args) }));

import { useShifts } from './useShifts';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useShifts', () => {
  beforeEach(() => getShiftsMock.mockReset());

  it('fetches shifts for the given branch/page/limit', async () => {
    getShiftsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useShifts('1', 1, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getShiftsMock).toHaveBeenCalledWith('1', { page: 1, limit: 10 });
  });

  it('is disabled when branchId is undefined', () => {
    const { result } = renderHook(() => useShifts(undefined, 1, 10), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getShiftsMock).not.toHaveBeenCalled();
  });
});
