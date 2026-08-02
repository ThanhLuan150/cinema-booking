import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getScheduleIdMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getScheduleId: (...args: unknown[]) => getScheduleIdMock(...args) }));

import { useScheduleId } from './useScheduleId';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useScheduleId', () => {
  beforeEach(() => getScheduleIdMock.mockReset());

  it('is disabled when params is null', () => {
    const { result } = renderHook(() => useScheduleId(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('is disabled when a required param is missing', () => {
    const { result } = renderHook(
      () => useScheduleId({ movie_id: '1', movie_date: '', time_begin: '10:00' }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the schedule id when all params are present', async () => {
    getScheduleIdMock.mockResolvedValue({ id: 7 });
    const params = { movie_id: '1', movie_date: '2026-01-01', time_begin: '10:00' };
    const { result } = renderHook(() => useScheduleId(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScheduleIdMock).toHaveBeenCalledWith(params);
  });
});
