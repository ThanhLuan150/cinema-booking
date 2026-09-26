import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createInventoryMock = vi.fn();
const updateInventoryMock = vi.fn();
const deleteInventoryMock = vi.fn();
const importInventoryMock = vi.fn();
const returnInventoryMock = vi.fn();
const adjustInventoryMock = vi.fn();
const wasteInventoryMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createInventory: (...args: unknown[]) => createInventoryMock(...args),
  updateInventory: (...args: unknown[]) => updateInventoryMock(...args),
  deleteInventory: (...args: unknown[]) => deleteInventoryMock(...args),
  importInventory: (...args: unknown[]) => importInventoryMock(...args),
  returnInventory: (...args: unknown[]) => returnInventoryMock(...args),
  adjustInventory: (...args: unknown[]) => adjustInventoryMock(...args),
  wasteInventory: (...args: unknown[]) => wasteInventoryMock(...args),
}));

import {
  useAdjustInventory,
  useCreateInventory,
  useDeleteInventory,
  useImportInventory,
  useReturnInventory,
  useUpdateInventory,
  useWasteInventory,
} from './useInventoryMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

const details = {
  item: '  Popcorn ',
  sku: ' pop-l ',
  category: ' Food ',
  combo_id: '5',
  minimum_quantity: '2',
  unit: ' pcs ',
  cost_price: '18000',
  selling_price: '55000',
};

describe('inventory mutation hooks', () => {
  beforeEach(() => {
    for (const mock of [
      createInventoryMock,
      updateInventoryMock,
      deleteInventoryMock,
      importInventoryMock,
      returnInventoryMock,
      adjustInventoryMock,
      wasteInventoryMock,
    ]) {
      mock.mockReset();
    }
  });

  it('useCreateInventory trims, coerces numeric fields and invalidates every inventory query', async () => {
    createInventoryMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateInventory(), { wrapper });
    result.current.mutate({ cinema_id: '1', quantity: '10', ...details });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createInventoryMock).toHaveBeenCalledWith({
      branch_id: 1,
      item: 'Popcorn',
      sku: 'pop-l', // normalised (upper-cased) by the server, only trimmed here
      category: 'Food',
      combo_id: 5,
      quantity: 10,
      minimum_quantity: 2,
      unit: 'pcs',
      cost_price: 18000,
      selling_price: 55000,
    });
    for (const key of ['ownerInventory', 'inventoryAlerts', 'inventoryCategories', 'inventoryHistory']) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [key] });
    }
  });

  it('useCreateInventory sends null for a blank SKU / no combo and 0 for blank numbers', async () => {
    createInventoryMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateInventory(), { wrapper });
    result.current.mutate({
      cinema_id: '1',
      item: 'Flour',
      sku: '',
      category: '',
      combo_id: '',
      quantity: '',
      minimum_quantity: '',
      unit: 'kg',
      cost_price: '',
      selling_price: '',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createInventoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: null,
        combo_id: null,
        quantity: 0,
        minimum_quantity: 0,
        cost_price: 0,
        selling_price: 0,
      }),
    );
  });

  it('useUpdateInventory sends the catalogue fields only — never a quantity — and invalidates', async () => {
    updateInventoryMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdateInventory(), { wrapper });
    result.current.mutate({ id: 7, values: { ...details, combo_id: '' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [id, payload] = updateInventoryMock.mock.calls[0];
    expect(id).toBe(7);
    expect(payload).toMatchObject({ item: 'Popcorn', combo_id: null, selling_price: 55000 });
    expect(payload).not.toHaveProperty('quantity');
    expect(payload).not.toHaveProperty('branch_id');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerInventory'] });
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

  it.each([
    ['useImportInventory', useImportInventory, importInventoryMock],
    ['useReturnInventory', useReturnInventory, returnInventoryMock],
    ['useWasteInventory', useWasteInventory, wasteInventoryMock],
  ])('%s posts quantity/reason for the given id and refreshes the stock views', async (_name, useHook, mock) => {
    mock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useHook(), { wrapper });
    result.current.mutate({ id: 1, quantity: 5, reason: 'why' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mock).toHaveBeenCalledWith(1, { quantity: 5, reason: 'why' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerInventory'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventoryAlerts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventoryHistory'] });
  });

  it('useAdjustInventory posts the absolute quantity', async () => {
    adjustInventoryMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAdjustInventory(), { wrapper });
    result.current.mutate({ id: 1, quantity: 12 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adjustInventoryMock).toHaveBeenCalledWith(1, { quantity: 12, reason: undefined });
  });

  it('surfaces a server refusal (e.g. INSUFFICIENT_STOCK) as an error state', async () => {
    const error = { response: { data: { code: 'INSUFFICIENT_STOCK' } } };
    wasteInventoryMock.mockRejectedValue(error);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWasteInventory(), { wrapper });
    result.current.mutate({ id: 1, quantity: 99 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
