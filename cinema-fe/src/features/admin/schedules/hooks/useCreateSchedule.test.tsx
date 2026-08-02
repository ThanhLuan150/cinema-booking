import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createScheduleMock = vi.fn();
const createTicketMock = vi.fn();
vi.mock('../api/schedules.api', () => ({
  createSchedule: (...args: unknown[]) => createScheduleMock(...args),
  createTicket: (...args: unknown[]) => createTicketMock(...args),
}));

import { useCreateSchedule } from './useCreateSchedule';

describe('useCreateSchedule', () => {
  beforeEach(() => {
    createScheduleMock.mockReset();
    createTicketMock.mockReset();
  });

  it('creates the schedule, then generates tickets for it', async () => {
    createScheduleMock.mockResolvedValue({ data: { id: 7 } });
    createTicketMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const values = { room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1000 };
    const { result } = renderHook(() => useCreateSchedule(), { wrapper });
    result.current.mutate({ movieId: 5, values } as any);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createScheduleMock).toHaveBeenCalledWith({ movie_id: 5, ...values });
    expect(createTicketMock).toHaveBeenCalledWith({ schedule_id: 7 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminSchedules'] });
  });
});
