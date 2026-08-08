import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMovieDirectorsByMovieIdMock = vi.fn();
vi.mock('../api/movies.api', () => ({
  getMovieDirectorsByMovieId: (...args: unknown[]) => getMovieDirectorsByMovieIdMock(...args),
}));

import { useMovieDirectorsByMovieId } from './useMovieDirectorsByMovieId';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMovieDirectorsByMovieId', () => {
  beforeEach(() => getMovieDirectorsByMovieIdMock.mockReset());

  it('fetches director links for the movie', async () => {
    getMovieDirectorsByMovieIdMock.mockResolvedValue([{ id: 1, movie_id: 5, director_id: 2 }]);
    const { result } = renderHook(() => useMovieDirectorsByMovieId(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMovieDirectorsByMovieIdMock).toHaveBeenCalledWith(5);
  });

  it('stays disabled without a movie id', () => {
    const { result } = renderHook(() => useMovieDirectorsByMovieId(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMovieDirectorsByMovieIdMock).not.toHaveBeenCalled();
  });
});
