import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rescheduleScheduleMock = vi.fn();
vi.mock('../api/schedules.api', () => ({
  rescheduleSchedule: (...args: unknown[]) => rescheduleScheduleMock(...args),
}));

import { useRescheduleSchedule } from './useRescheduleSchedule';

describe('useRescheduleSchedule', () => {
  beforeEach(() => {
    rescheduleScheduleMock.mockReset();
  });

  it('calls rescheduleSchedule with the id and payload, then invalidates the schedules list', async () => {
    rescheduleScheduleMock.mockResolvedValue({ data: { id: 7 } });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { movie_date: '2026-01-10', time_begin: '14:00', time_end: '16:00' };
    const { result } = renderHook(() => useRescheduleSchedule(), { wrapper });
    result.current.mutate({ id: 7, payload });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rescheduleScheduleMock).toHaveBeenCalledWith(7, payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminSchedules'] });
  });
});
