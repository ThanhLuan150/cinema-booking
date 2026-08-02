import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const unlikeMovieMock = vi.fn();
vi.mock('../api/movies.api', () => ({ unlikeMovie: (...args: unknown[]) => unlikeMovieMock(...args) }));

import { useUnlikeMutation } from './useUnlikeMutation';

describe('useUnlikeMutation', () => {
  beforeEach(() => unlikeMovieMock.mockReset());

  it('calls unlikeMovie and invalidates like-status/liked-movies queries on success', async () => {
    unlikeMovieMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useUnlikeMutation(), { wrapper });
    result.current.mutate({ movie_id: 5 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(unlikeMovieMock).toHaveBeenCalledWith({ movie_id: 5 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['like', 5] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myLikedMovies'] });
  });
});
