import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMoviesMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getMovies: (...args: unknown[]) => getMoviesMock(...args) }));

import { useMovies } from './useMovies';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMovies', () => {
  beforeEach(() => getMoviesMock.mockReset());

  it('fetches movies with the given filters and pagination', async () => {
    getMoviesMock.mockResolvedValue({ data: [], total: 0 });
    const filters = { search: 'matrix' };
    const pagination = { page: 1, limit: 10 };
    const { result } = renderHook(() => useMovies(filters as any, pagination as any), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMoviesMock).toHaveBeenCalledWith(filters, pagination);
  });
});
