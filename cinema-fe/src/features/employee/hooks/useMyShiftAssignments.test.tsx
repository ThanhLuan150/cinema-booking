import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyShiftAssignmentsMock = vi.fn();
vi.mock('../api/employee.api', () => ({
  getMyShiftAssignments: (...args: unknown[]) => getMyShiftAssignmentsMock(...args),
}));

import { useMyShiftAssignments } from './useMyShiftAssignments';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyShiftAssignments', () => {
  beforeEach(() => getMyShiftAssignmentsMock.mockReset());

  it("fetches the full list of the employee's own shift assignments", async () => {
    getMyShiftAssignmentsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useMyShiftAssignments(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyShiftAssignmentsMock).toHaveBeenCalledWith({ limit: 100 });
  });
});
