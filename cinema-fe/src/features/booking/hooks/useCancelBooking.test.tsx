import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const cancelBookingMock = vi.fn();
vi.mock('../api/booking.api', () => ({ cancelBooking: (...args: unknown[]) => cancelBookingMock(...args) }));

import { useCancelBooking } from './useCancelBooking';

describe('useCancelBooking', () => {
  beforeEach(() => cancelBookingMock.mockReset());

  it('cancels the booking and invalidates the bookings query', async () => {
    cancelBookingMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useCancelBooking(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelBookingMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
  });
});
