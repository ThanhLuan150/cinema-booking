import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const changeBookingShowtimeMock = vi.fn();
vi.mock('../api/booking.api', () => ({ changeBookingShowtime: (...args: unknown[]) => changeBookingShowtimeMock(...args) }));

import { useChangeBookingShowtime } from './useChangeBookingShowtime';

describe('useChangeBookingShowtime', () => {
  beforeEach(() => changeBookingShowtimeMock.mockReset());

  it('changes the showtime and invalidates the bookings query', async () => {
    changeBookingShowtimeMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useChangeBookingShowtime(), { wrapper });
    result.current.mutate({ bookingId: 5, schedule_id: 9, seatCodes: ['A1'] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(changeBookingShowtimeMock).toHaveBeenCalledWith(5, { schedule_id: 9, seatCodes: ['A1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
  });
});
