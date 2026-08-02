import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOwnerDashboardMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getOwnerDashboard: (...args: unknown[]) => getOwnerDashboardMock(...args) }));

import { useOwnerDashboardStats } from './useOwnerDashboardStats';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerDashboardStats', () => {
  beforeEach(() => getOwnerDashboardMock.mockReset());

  it('fetches dashboard stats scoped to the given cinema id', async () => {
    getOwnerDashboardMock.mockResolvedValue({ revenue: 1000 });
    const { result } = renderHook(() => useOwnerDashboardStats('5'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerDashboardMock).toHaveBeenCalledWith('5');
  });

  it('passes undefined when no cinemaId is provided', async () => {
    getOwnerDashboardMock.mockResolvedValue({ revenue: 1000 });
    const { result } = renderHook(() => useOwnerDashboardStats(undefined), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getOwnerDashboardMock).toHaveBeenCalledWith(undefined);
  });
});
