import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const deliverComboOrderMock = vi.fn();
vi.mock('../api/comboOrder.api', () => ({ deliverComboOrder: (...args: unknown[]) => deliverComboOrderMock(...args) }));

import { useDeliverComboOrder } from './useDeliverComboOrder';

describe('useDeliverComboOrder', () => {
  beforeEach(() => deliverComboOrderMock.mockReset());

  it('moves the order to DELIVERED and invalidates the comboOrders query', async () => {
    deliverComboOrderMock.mockResolvedValue({ id: 1, status: 'DELIVERED' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useDeliverComboOrder(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deliverComboOrderMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comboOrders'] });
  });
});
