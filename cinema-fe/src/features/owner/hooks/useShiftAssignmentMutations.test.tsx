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
    result.current.mutate({
      employee_id: '1',
      shift_id: '2',
      position_id: '',
      date: '2026-08-12',
      start_time: '',
      end_time: '',
    });
    await waitFor(() =>
      expect(createShiftAssignmentMock).toHaveBeenCalledWith({ employee_id: 1, shift_id: 2, date: '2026-08-12' }),
    );
  });

  it('sends the chosen start/end as explicit instants in the browser timezone', async () => {
    createShiftAssignmentMock.mockResolvedValue({});
    const { result } = renderHook(() => useCreateShiftAssignment(), { wrapper });
    result.current.mutate({
      employee_id: '1',
      shift_id: '2',
      position_id: '',
      date: '2026-08-12',
      start_time: '09:00',
      end_time: '13:30',
    });
    await waitFor(() =>
      expect(createShiftAssignmentMock).toHaveBeenCalledWith({
        employee_id: 1,
        shift_id: 2,
        date: '2026-08-12',
        start_at: new Date('2026-08-12T09:00:00').toISOString(),
        end_at: new Date('2026-08-12T13:30:00').toISOString(),
      }),
    );
  });

  it('rolls an end time at or before the start onto the next day (overnight shift)', async () => {
    createShiftAssignmentMock.mockResolvedValue({});
    const { result } = renderHook(() => useCreateShiftAssignment(), { wrapper });
    result.current.mutate({
      employee_id: '1',
      shift_id: '2',
      position_id: '',
      date: '2026-08-12',
      start_time: '22:00',
      end_time: '02:00',
    });
    await waitFor(() =>
      expect(createShiftAssignmentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          start_at: new Date('2026-08-12T22:00:00').toISOString(),
          end_at: new Date('2026-08-13T02:00:00').toISOString(),
        }),
      ),
    );
  });

  it('sends the chosen position as a number, and omits it when left on the default', async () => {
    createShiftAssignmentMock.mockResolvedValue({});
    const { result } = renderHook(() => useCreateShiftAssignment(), { wrapper });
    result.current.mutate({
      employee_id: '1',
      shift_id: '2',
      position_id: '4',
      date: '2026-08-12',
      start_time: '',
      end_time: '',
    });
    await waitFor(() =>
      expect(createShiftAssignmentMock).toHaveBeenCalledWith({
        employee_id: 1,
        shift_id: 2,
        position_id: 4,
        date: '2026-08-12',
      }),
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
