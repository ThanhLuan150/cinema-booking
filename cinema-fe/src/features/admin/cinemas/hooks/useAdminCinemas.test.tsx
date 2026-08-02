import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyCinemasMock = vi.fn();
vi.mock('@/features/owner/api/owner.api', () => ({ getMyCinemas: (...args: unknown[]) => getMyCinemasMock(...args) }));

import { useAdminCinemas } from './useAdminCinemas';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAdminCinemas', () => {
  beforeEach(() => getMyCinemasMock.mockReset());

  it('fetches cinemas for the given page/limit', async () => {
    getMyCinemasMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useAdminCinemas(2, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyCinemasMock).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });
});
