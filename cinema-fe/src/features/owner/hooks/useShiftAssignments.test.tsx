import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getShiftAssignmentsMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  getShiftAssignments: (...args: unknown[]) => getShiftAssignmentsMock(...args),
}));

import { useShiftAssignments } from './useShiftAssignments';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useShiftAssignments', () => {
  beforeEach(() => getShiftAssignmentsMock.mockReset());

  it('fetches assignments for the given branch/filters/page/limit', async () => {
    getShiftAssignmentsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useShiftAssignments('1', { employeeId: '2' }, 1, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getShiftAssignmentsMock).toHaveBeenCalledWith('1', { employeeId: '2', page: 1, limit: 10 });
  });

  it('is disabled when branchId is undefined', () => {
    const { result } = renderHook(() => useShiftAssignments(undefined, {}, 1, 10), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getShiftAssignmentsMock).not.toHaveBeenCalled();
  });
});
