import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createHolidayMock = vi.fn();
const deleteHolidayMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createHoliday: (...args: unknown[]) => createHolidayMock(...args),
  deleteHoliday: (...args: unknown[]) => deleteHolidayMock(...args),
}));

import { useCreateHoliday, useDeleteHoliday } from './useHolidayMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('holiday mutation hooks', () => {
  beforeEach(() => {
    createHolidayMock.mockReset();
    deleteHolidayMock.mockReset();
  });

  it('useCreateHoliday posts the payload and invalidates ownerHolidays', async () => {
    createHolidayMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateHoliday(), { wrapper });
    result.current.mutate({ date: '2026-12-25', name: 'Christmas', branch_id: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createHolidayMock).toHaveBeenCalledWith({ date: '2026-12-25', name: 'Christmas', branch_id: null });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerHolidays'] });
  });

  it('useDeleteHoliday deletes and invalidates ownerHolidays', async () => {
    deleteHolidayMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteHoliday(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteHolidayMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerHolidays'] });
  });
});
