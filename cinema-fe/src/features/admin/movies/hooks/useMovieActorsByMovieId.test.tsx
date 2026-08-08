import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMovieActorsByMovieIdMock = vi.fn();
vi.mock('../api/movies.api', () => ({
  getMovieActorsByMovieId: (...args: unknown[]) => getMovieActorsByMovieIdMock(...args),
}));

import { useMovieActorsByMovieId } from './useMovieActorsByMovieId';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMovieActorsByMovieId', () => {
  beforeEach(() => getMovieActorsByMovieIdMock.mockReset());

  it('fetches actor links for the movie', async () => {
    getMovieActorsByMovieIdMock.mockResolvedValue([{ id: 1, movie_id: 5, actor_id: 2, character_name: 'Hero', is_lead: true }]);
    const { result } = renderHook(() => useMovieActorsByMovieId(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMovieActorsByMovieIdMock).toHaveBeenCalledWith(5);
  });

  it('stays disabled without a movie id', () => {
    const { result } = renderHook(() => useMovieActorsByMovieId(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMovieActorsByMovieIdMock).not.toHaveBeenCalled();
  });
});
