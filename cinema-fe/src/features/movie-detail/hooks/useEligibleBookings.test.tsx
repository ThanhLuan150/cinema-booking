import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getEligibleBookingsMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  getEligibleBookings: (...args: unknown[]) => getEligibleBookingsMock(...args),
}));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useIsAuthenticated: () => useIsAuthenticatedMock(),
}));

import { useEligibleBookings, eligibleBookingsQueryKey } from './useEligibleBookings';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('eligibleBookingsQueryKey', () => {
  it('stringifies the movie id', () => {
    expect(eligibleBookingsQueryKey(5)).toEqual(['movieReviewEligibleBookings', '5']);
    expect(eligibleBookingsQueryKey(undefined)).toEqual(['movieReviewEligibleBookings', undefined]);
  });
});

describe('useEligibleBookings', () => {
  beforeEach(() => {
    getEligibleBookingsMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when movieId is undefined', () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    const { result } = renderHook(() => useEligibleBookings(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is disabled when the user is not logged in', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useEligibleBookings(1), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches eligible bookings when logged in with a movieId', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getEligibleBookingsMock.mockResolvedValue([{ booking_id: 1, code: 'BK1', schedule_id: 1 }]);
    const { result } = renderHook(() => useEligibleBookings(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getEligibleBookingsMock).toHaveBeenCalledWith(1);
    expect(result.current.data).toEqual([{ booking_id: 1, code: 'BK1', schedule_id: 1 }]);
  });
});
