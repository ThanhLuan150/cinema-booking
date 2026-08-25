import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createComboOrderMock = vi.fn();
vi.mock('../api/comboOrder.api', () => ({ createComboOrder: (...args: unknown[]) => createComboOrderMock(...args) }));

import { useCreateComboOrder } from './useCreateComboOrder';

describe('useCreateComboOrder', () => {
  beforeEach(() => createComboOrderMock.mockReset());

  it('creates the order and invalidates the comboOrders query', async () => {
    createComboOrderMock.mockResolvedValue({ id: 1, status: 'PENDING' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useCreateComboOrder(), { wrapper });
    const payload = { branch_id: 1, items: [{ combo_id: 1, quantity: 2 }] };
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createComboOrderMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comboOrders'] });
  });
});
