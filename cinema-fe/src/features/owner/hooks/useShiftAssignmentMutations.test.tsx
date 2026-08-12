import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createShiftAssignmentMock = vi.fn();
const updateShiftAssignmentMock = vi.fn();
const deleteShiftAssignmentMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createShiftAssignment: (...args: unknown[]) => createShiftAssignmentMock(...args),
  updateShiftAssignment: (...args: unknown[]) => updateShiftAssignmentMock(...args),
  deleteShiftAssignment: (...args: unknown[]) => deleteShiftAssignmentMock(...args),
}));

import { useCancelShiftAssignment, useCreateShiftAssignment, useDeleteShiftAssignment } from './useShiftAssignmentMutations';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useShiftAssignmentMutations', () => {
  beforeEach(() => {
    createShiftAssignmentMock.mockReset();
    updateShiftAssignmentMock.mockReset();
    deleteShiftAssignmentMock.mockReset();
  });

  it('creates a shift assignment with numeric ids', async () => {
    createShiftAssignmentMock.mockResolvedValue({});
    const { result } = renderHook(() => useCreateShiftAssignment(), { wrapper });
    result.current.mutate({ employee_id: '1', shift_id: '2', date: '2026-08-12' });
    await waitFor(() =>
      expect(createShiftAssignmentMock).toHaveBeenCalledWith({ employee_id: 1, shift_id: 2, date: '2026-08-12' }),
    );
  });

  it('cancels a shift assignment', async () => {
    updateShiftAssignmentMock.mockResolvedValue({});
    const { result } = renderHook(() => useCancelShiftAssignment(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(updateShiftAssignmentMock).toHaveBeenCalledWith(1, { status: 'CANCELLED' }));
  });

  it('deletes a shift assignment', async () => {
    deleteShiftAssignmentMock.mockResolvedValue({});
    const { result } = renderHook(() => useDeleteShiftAssignment(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(deleteShiftAssignmentMock).toHaveBeenCalledWith(1));
  });
});
