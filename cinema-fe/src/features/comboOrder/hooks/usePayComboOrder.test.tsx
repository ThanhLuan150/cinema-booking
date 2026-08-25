import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const payComboOrderMock = vi.fn();
vi.mock('../api/comboOrder.api', () => ({ payComboOrder: (...args: unknown[]) => payComboOrderMock(...args) }));

import { usePayComboOrder } from './usePayComboOrder';

describe('usePayComboOrder', () => {
  beforeEach(() => payComboOrderMock.mockReset());

  it('pays the order and invalidates the comboOrders query', async () => {
    payComboOrderMock.mockResolvedValue({ id: 1, status: 'PAID' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => usePayComboOrder(), { wrapper });
    result.current.mutate({ id: 1, method: 'CASH' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(payComboOrderMock).toHaveBeenCalledWith(1, 'CASH');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comboOrders'] });
  });
});
