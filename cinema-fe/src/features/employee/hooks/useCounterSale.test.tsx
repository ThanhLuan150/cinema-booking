import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createCounterSaleMock = vi.fn();
vi.mock('../api/employee.api', () => ({ createCounterSale: (...args: unknown[]) => createCounterSaleMock(...args) }));

import { useCreateCounterSale } from './useCounterSale';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('useCreateCounterSale', () => {
  beforeEach(() => createCounterSaleMock.mockReset());

  it('posts the payload and invalidates schedule seats', async () => {
    createCounterSaleMock.mockResolvedValue({ id: 1 });
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateCounterSale(), { wrapper });
    const payload = {
      ticketIds: [1, 2],
      comboIds: [],
      voucherCode: null,
      discountAmount: 0,
      totalPrice: 200000,
      accountId: 5,
      cinema_id: 1,
    };
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createCounterSaleMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['employeeScheduleSeats'] });
  });
});
