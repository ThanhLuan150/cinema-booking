import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createShiftMock = vi.fn();
const updateShiftMock = vi.fn();
const deleteShiftMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createShift: (...args: unknown[]) => createShiftMock(...args),
  updateShift: (...args: unknown[]) => updateShiftMock(...args),
  deleteShift: (...args: unknown[]) => deleteShiftMock(...args),
}));

import { useCreateShift, useDeleteShift, useUpdateShift } from './useShiftMutations';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useShiftMutations', () => {
  beforeEach(() => {
    createShiftMock.mockReset();
    updateShiftMock.mockReset();
    deleteShiftMock.mockReset();
  });

  it('creates a shift with numeric branch_id', async () => {
    createShiftMock.mockResolvedValue({});
    const { result } = renderHook(() => useCreateShift(), { wrapper });
    result.current.mutate({ branch_id: '1', name: 'Morning', start_time: '08:00', end_time: '16:00' });
    await waitFor(() => expect(createShiftMock).toHaveBeenCalledWith({
      branch_id: 1,
      name: 'Morning',
      start_time: '08:00',
      end_time: '16:00',
    }));
  });

  it('updates a shift', async () => {
    updateShiftMock.mockResolvedValue({});
    const { result } = renderHook(() => useUpdateShift(), { wrapper });
    result.current.mutate({ id: 1, status: 'INACTIVE' });
    await waitFor(() => expect(updateShiftMock).toHaveBeenCalledWith(1, { status: 'INACTIVE' }));
  });

  it('deletes a shift', async () => {
    deleteShiftMock.mockResolvedValue({});
    const { result } = renderHook(() => useDeleteShift(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(deleteShiftMock).toHaveBeenCalledWith(1));
  });
});
