import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createInventoryMock = vi.fn();
const deleteInventoryMock = vi.fn();
const receiveInventoryMock = vi.fn();
const adjustInventoryMock = vi.fn();
const deductInventoryMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createInventory: (...args: unknown[]) => createInventoryMock(...args),
  deleteInventory: (...args: unknown[]) => deleteInventoryMock(...args),
  receiveInventory: (...args: unknown[]) => receiveInventoryMock(...args),
  adjustInventory: (...args: unknown[]) => adjustInventoryMock(...args),
  deductInventory: (...args: unknown[]) => deductInventoryMock(...args),
}));

import {
  useAdjustInventory,
  useCreateInventory,
  useDeductInventory,
  useDeleteInventory,
  useReceiveInventory,
} from './useInventoryMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('inventory mutation hooks', () => {
  beforeEach(() => {
    createInventoryMock.mockReset();
    deleteInventoryMock.mockReset();
    receiveInventoryMock.mockReset();
    adjustInventoryMock.mockReset();
    deductInventoryMock.mockReset();
  });

  it('useCreateInventory coerces numeric fields and invalidates inventory queries', async () => {
    createInventoryMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateInventory(), { wrapper });
    result.current.mutate({
      cinema_id: '1',
      item: 'Popcorn',
      combo_id: '5',
      quantity: '10',
      minimum_quantity: '2',
      unit: 'pcs',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createInventoryMock).toHaveBeenCalledWith({
      branch_id: 1,
      item: 'Popcorn',
      combo_id: 5,
      quantity: 10,
      minimum_quantity: 2,
      unit: 'pcs',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerInventory'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventoryAlerts'] });
  });

  it('useCreateInventory sends null combo_id when not linked', async () => {
    createInventoryMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateInventory(), { wrapper });
    result.current.mutate({ cinema_id: '1', item: 'Flour', combo_id: '', quantity: '', minimum_quantity: '', unit: 'kg' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createInventoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ combo_id: null, quantity: 0, minimum_quantity: 0 }),
    );
  });

  it('useDeleteInventory deletes and invalidates', async () => {
    deleteInventoryMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteInventory(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteInventoryMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerInventory'] });
  });

  it('useReceiveInventory posts quantity/reason for the given id', async () => {
    receiveInventoryMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useReceiveInventory(), { wrapper });
    result.current.mutate({ id: 1, quantity: 5, reason: 'restock' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receiveInventoryMock).toHaveBeenCalledWith(1, { quantity: 5, reason: 'restock' });
  });

  it('useAdjustInventory posts the absolute quantity', async () => {
    adjustInventoryMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAdjustInventory(), { wrapper });
    result.current.mutate({ id: 1, quantity: 12 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adjustInventoryMock).toHaveBeenCalledWith(1, { quantity: 12, reason: undefined });
  });

  it('useDeductInventory posts the deduction quantity', async () => {
    deductInventoryMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeductInventory(), { wrapper });
    result.current.mutate({ id: 1, quantity: 3, reason: 'spoiled' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deductInventoryMock).toHaveBeenCalledWith(1, { quantity: 3, reason: 'spoiled' });
  });
});
