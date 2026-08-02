import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAdminDashboardStatsMock = vi.fn();
vi.mock('../api/dashboard.api', () => ({ getAdminDashboardStats: () => getAdminDashboardStatsMock() }));

import { useAdminDashboardStats } from './useAdminDashboardStats';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAdminDashboardStats', () => {
  beforeEach(() => getAdminDashboardStatsMock.mockReset());

  it('fetches the admin dashboard stats', async () => {
    getAdminDashboardStatsMock.mockResolvedValue({ totalRevenue: 1000 });
    const { result } = renderHook(() => useAdminDashboardStats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totalRevenue: 1000 });
  });
});
