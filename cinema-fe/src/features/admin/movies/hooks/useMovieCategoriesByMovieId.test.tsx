import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMovieCategoriesByMovieIdMock = vi.fn();
vi.mock('../api/movies.api', () => ({
  getMovieCategoriesByMovieId: (...args: unknown[]) => getMovieCategoriesByMovieIdMock(...args),
}));

import { useMovieCategoriesByMovieId } from './useMovieCategoriesByMovieId';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMovieCategoriesByMovieId', () => {
  beforeEach(() => getMovieCategoriesByMovieIdMock.mockReset());

  it('is disabled when movieId is undefined', () => {
    const { result } = renderHook(() => useMovieCategoriesByMovieId(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches category ids for the movie', async () => {
    getMovieCategoriesByMovieIdMock.mockResolvedValue([1, 2]);
    const { result } = renderHook(() => useMovieCategoriesByMovieId(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMovieCategoriesByMovieIdMock).toHaveBeenCalledWith(5);
  });
});
