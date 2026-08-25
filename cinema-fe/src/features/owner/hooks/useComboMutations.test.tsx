import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createComboMock = vi.fn();
const updateComboMock = vi.fn();
const deleteComboMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createCombo: (...args: unknown[]) => createComboMock(...args),
  updateCombo: (...args: unknown[]) => updateComboMock(...args),
  deleteCombo: (...args: unknown[]) => deleteComboMock(...args),
}));

import { useCreateCombo, useUpdateCombo, useDeleteCombo } from './useComboMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('combo mutation hooks', () => {
  beforeEach(() => {
    createComboMock.mockReset();
    updateComboMock.mockReset();
    deleteComboMock.mockReset();
  });

  it('useCreateCombo coerces price/cinema_id to numbers and invalidates ownerCombos', async () => {
    createComboMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateCombo(), { wrapper });
    result.current.mutate({
      name: 'Combo',
      description: 'Tasty',
      price: '50000',
      cinema_id: '1',
      type: 'FOOD',
      items: {},
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createComboMock).toHaveBeenCalledWith({
      name: 'Combo',
      description: 'Tasty',
      price: 50000,
      cinema_id: 1,
      type: 'FOOD',
      items: [],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerCombos'] });
  });

  it('useCreateCombo normalizes a COMBO type\'s items map to an array, dropping zero quantities', async () => {
    createComboMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCombo(), { wrapper });
    result.current.mutate({
      name: 'Combo Bắp Nước',
      description: '',
      price: '65000',
      cinema_id: '1',
      type: 'COMBO',
      items: { 1: 2, 2: 0, 3: 1 },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createComboMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'COMBO',
        items: [
          { item_id: 1, quantity: 2 },
          { item_id: 3, quantity: 1 },
        ],
      }),
    );
  });

  it('useUpdateCombo toggles active and invalidates ownerCombos', async () => {
    updateComboMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useUpdateCombo(), { wrapper });
    result.current.mutate({ id: 1, active: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateComboMock).toHaveBeenCalledWith(1, { active: false });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerCombos'] });
  });

  it('useDeleteCombo deletes and invalidates ownerCombos', async () => {
    deleteComboMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteCombo(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteComboMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerCombos'] });
  });
});
