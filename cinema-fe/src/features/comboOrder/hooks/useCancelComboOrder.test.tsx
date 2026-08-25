import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const cancelComboOrderMock = vi.fn();
vi.mock('../api/comboOrder.api', () => ({ cancelComboOrder: (...args: unknown[]) => cancelComboOrderMock(...args) }));

import { useCancelComboOrder } from './useCancelComboOrder';

describe('useCancelComboOrder', () => {
  beforeEach(() => cancelComboOrderMock.mockReset());

  it('cancels the order and invalidates the comboOrders query', async () => {
    cancelComboOrderMock.mockResolvedValue({ id: 1, status: 'CANCELLED' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useCancelComboOrder(), { wrapper });
    result.current.mutate({ id: 1, reason: 'out of stock' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelComboOrderMock).toHaveBeenCalledWith(1, 'out of stock');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comboOrders'] });
  });
});
