import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getKdsBoardMock = vi.fn();
const updateKdsStatusMock = vi.fn();
const getKdsBranchesMock = vi.fn();
vi.mock('../api/kds.api', () => ({
  getKdsBoard: (...args: unknown[]) => getKdsBoardMock(...args),
  updateKdsStatus: (...args: unknown[]) => updateKdsStatusMock(...args),
  getKdsBranches: (...args: unknown[]) => getKdsBranchesMock(...args),
}));

import { useKdsBoard, useKdsBranches, useUpdateKdsStatus } from './useKdsBoard';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('useKdsBoard', () => {
  beforeEach(() => {
    getKdsBoardMock.mockReset();
    getKdsBranchesMock.mockReset();
    updateKdsStatusMock.mockReset();
  });

  it('loads the board of the given branch', async () => {
    getKdsBoardMock.mockResolvedValue({ orders: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useKdsBoard(4), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getKdsBoardMock).toHaveBeenCalledWith(4, {});
  });

  it('lists the branches the viewer may open, under the board key (refreshed with it)', async () => {
    getKdsBranchesMock.mockResolvedValue([{ id: 1, active: 3 }]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useKdsBranches(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 1, active: 3 }]));
  });

  it('does not list branches while disabled', () => {
    const { wrapper } = setup();
    renderHook(() => useKdsBranches(false), { wrapper });
    expect(getKdsBranchesMock).not.toHaveBeenCalled();
  });

  it('does not fetch until a branch is known', () => {
    const { wrapper } = setup();
    renderHook(() => useKdsBoard(null), { wrapper });
    expect(getKdsBoardMock).not.toHaveBeenCalled();
  });

  it('updates a status on the branch KDS and refreshes both the board and the counter list', async () => {
    updateKdsStatusMock.mockResolvedValue({ id: 9, status: 'READY' });
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useUpdateKdsStatus(4), { wrapper });
    result.current.mutate({ orderId: 9, status: 'READY' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateKdsStatusMock).toHaveBeenCalledWith(4, 9, { status: 'READY' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kdsBoard'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comboOrders'] });
  });

  it('refreshes the board after a failed update too (someone else moved the order)', async () => {
    updateKdsStatusMock.mockRejectedValue(new Error('409'));
    const { wrapper, invalidateSpy } = setup();
    const { result } = renderHook(() => useUpdateKdsStatus(4), { wrapper });
    result.current.mutate({ orderId: 9, status: 'READY' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kdsBoard'] });
  });
});
