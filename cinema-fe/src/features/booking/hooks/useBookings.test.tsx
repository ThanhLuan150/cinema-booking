import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getBookingsMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getBookings: (...args: unknown[]) => getBookingsMock(...args) }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useBookings } from './useBookings';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useBookings', () => {
  beforeEach(() => {
    getBookingsMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when the caller is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useBookings(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches bookings with the given params when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getBookingsMock.mockResolvedValue({ data: [{ id: 1 }], total: 1, page: 1, limit: 20, totalPages: 1 });
    const { result } = renderHook(() => useBookings({ page: 2, status: 'PAID' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getBookingsMock).toHaveBeenCalledWith({ page: 2, status: 'PAID' });
  });
});
