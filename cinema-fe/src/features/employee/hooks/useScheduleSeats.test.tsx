import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getScheduleSeatsMock = vi.fn();
vi.mock('../api/employee.api', () => ({ getScheduleSeats: (...args: unknown[]) => getScheduleSeatsMock(...args) }));

import { useScheduleSeats } from './useScheduleSeats';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useScheduleSeats', () => {
  beforeEach(() => getScheduleSeatsMock.mockReset());

  it('fetches seats for the given schedule', async () => {
    getScheduleSeatsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useScheduleSeats(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScheduleSeatsMock).toHaveBeenCalledWith(5);
  });

  it('stays disabled without a schedule id', () => {
    const { result } = renderHook(() => useScheduleSeats(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getScheduleSeatsMock).not.toHaveBeenCalled();
  });
});
