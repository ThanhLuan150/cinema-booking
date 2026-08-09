import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getSchedulesMock = vi.fn();
vi.mock('../api/schedules.api', () => ({ getSchedules: (...args: unknown[]) => getSchedulesMock(...args) }));

import { useSchedules } from './useSchedules';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSchedules', () => {
  beforeEach(() => getSchedulesMock.mockReset());

  it('fetches schedules with filters, page and limit', async () => {
    getSchedulesMock.mockResolvedValue({ data: [], total: 0 });
    const filters = { branchId: 1 };
    const { result } = renderHook(() => useSchedules(filters, 1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSchedulesMock).toHaveBeenCalledWith(filters, { page: 1, limit: 20 });
  });
});
