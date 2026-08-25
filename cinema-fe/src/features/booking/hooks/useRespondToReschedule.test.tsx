import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const respondToRescheduleMock = vi.fn();
vi.mock('../api/booking.api', () => ({
  respondToReschedule: (...args: unknown[]) => respondToRescheduleMock(...args),
}));

import { useRespondToReschedule } from './useRespondToReschedule';

describe('useRespondToReschedule', () => {
  beforeEach(() => respondToRescheduleMock.mockReset());

  it('sends the decision and invalidates the bookings query', async () => {
    respondToRescheduleMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useRespondToReschedule(), { wrapper });
    result.current.mutate({ bookingId: 5, action: 'ACCEPT' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(respondToRescheduleMock).toHaveBeenCalledWith(5, 'ACCEPT');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
  });
});
