import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const readyComboOrderMock = vi.fn();
vi.mock('../api/comboOrder.api', () => ({ readyComboOrder: (...args: unknown[]) => readyComboOrderMock(...args) }));

import { useReadyComboOrder } from './useReadyComboOrder';

describe('useReadyComboOrder', () => {
  beforeEach(() => readyComboOrderMock.mockReset());

  it('moves the order to READY and invalidates the comboOrders query', async () => {
    readyComboOrderMock.mockResolvedValue({ id: 1, status: 'READY' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useReadyComboOrder(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readyComboOrderMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comboOrders'] });
  });
});
