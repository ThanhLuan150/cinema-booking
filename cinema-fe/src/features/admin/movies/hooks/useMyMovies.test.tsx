import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyMoviesMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getMyMovies: (...args: unknown[]) => getMyMoviesMock(...args) }));

import { useMyMovies } from './useMyMovies';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyMovies', () => {
  beforeEach(() => getMyMoviesMock.mockReset());

  it('fetches movies for the given page/limit', async () => {
    getMyMoviesMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useMyMovies(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyMoviesMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
