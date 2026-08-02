import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getScheduleMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getSchedule: (...args: unknown[]) => getScheduleMock(...args) }));

import { useScheduleDetail } from './useScheduleDetail';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useScheduleDetail', () => {
  beforeEach(() => getScheduleMock.mockReset());

  it('is disabled when scheduleId is null', () => {
    const { result } = renderHook(() => useScheduleDetail(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the schedule detail', async () => {
    getScheduleMock.mockResolvedValue({ id: 5, price: 100000 });
    const { result } = renderHook(() => useScheduleDetail(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScheduleMock).toHaveBeenCalledWith(5);
  });
});
