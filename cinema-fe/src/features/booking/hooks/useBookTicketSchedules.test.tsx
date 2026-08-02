import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getBookTicketScheduleMock = vi.fn();
vi.mock('../api/booking.api', () => ({
  getBookTicketSchedule: (...args: unknown[]) => getBookTicketScheduleMock(...args),
}));

import { useBookTicketSchedules } from './useBookTicketSchedules';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useBookTicketSchedules', () => {
  beforeEach(() => getBookTicketScheduleMock.mockReset());

  it('is disabled when movieId is undefined', () => {
    const { result } = renderHook(() => useBookTicketSchedules(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches showtimes for the movie', async () => {
    getBookTicketScheduleMock.mockResolvedValue([{ movie_date: '2026-01-01', times: ['10:00'] }]);
    const { result } = renderHook(() => useBookTicketSchedules(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getBookTicketScheduleMock).toHaveBeenCalledWith(5);
  });
});
