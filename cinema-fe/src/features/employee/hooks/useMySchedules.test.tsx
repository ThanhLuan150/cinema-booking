import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMySchedulesMock = vi.fn();
vi.mock('../api/employee.api', () => ({ getMySchedules: (...args: unknown[]) => getMySchedulesMock(...args) }));

import { useMySchedules } from './useMySchedules';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMySchedules', () => {
  beforeEach(() => getMySchedulesMock.mockReset());

  it('fetches the full list of the employee\'s own-cinema schedules', async () => {
    getMySchedulesMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useMySchedules(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMySchedulesMock).toHaveBeenCalledWith({ limit: 100 });
  });
});
