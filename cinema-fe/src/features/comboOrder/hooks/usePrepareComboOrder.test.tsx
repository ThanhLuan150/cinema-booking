import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const prepareComboOrderMock = vi.fn();
vi.mock('../api/comboOrder.api', () => ({ prepareComboOrder: (...args: unknown[]) => prepareComboOrderMock(...args) }));

import { usePrepareComboOrder } from './usePrepareComboOrder';

describe('usePrepareComboOrder', () => {
  beforeEach(() => prepareComboOrderMock.mockReset());

  it('moves the order to PREPARING and invalidates the comboOrders query', async () => {
    prepareComboOrderMock.mockResolvedValue({ id: 1, status: 'PREPARING' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => usePrepareComboOrder(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(prepareComboOrderMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comboOrders'] });
  });
});
