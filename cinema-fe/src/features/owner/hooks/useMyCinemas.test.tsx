import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const getMyCinemasMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getMyCinemas: (...args: unknown[]) => getMyCinemasMock(...args) }));

import { useMyCinemas } from './useMyCinemas';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyCinemas', () => {
  beforeEach(() => getMyCinemasMock.mockReset());

  it('fetches all cinemas with the full-list limit', async () => {
    getMyCinemasMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useMyCinemas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyCinemasMock).toHaveBeenCalledWith({ limit: FULL_LIST_FETCH_LIMIT });
  });
});
