import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCinemaFavoriteCountMock = vi.fn();
vi.mock('@/features/movies/api/movies.api', () => ({
  getCinemaFavoriteCount: (...args: unknown[]) => getCinemaFavoriteCountMock(...args),
}));

import { useCinemaFavoriteCount } from './useCinemaFavoriteCount';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCinemaFavoriteCount', () => {
  beforeEach(() => getCinemaFavoriteCountMock.mockReset());

  it('is disabled when cinemaId is undefined', () => {
    const { result } = renderHook(() => useCinemaFavoriteCount(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the favorite count when cinemaId is provided', async () => {
    getCinemaFavoriteCountMock.mockResolvedValue(4);
    const { result } = renderHook(() => useCinemaFavoriteCount(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(4);
  });
});
