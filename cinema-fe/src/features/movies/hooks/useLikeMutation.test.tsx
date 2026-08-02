import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const likeMovieMock = vi.fn();
vi.mock('../api/movies.api', () => ({ likeMovie: (...args: unknown[]) => likeMovieMock(...args) }));

import { useLikeMutation } from './useLikeMutation';

describe('useLikeMutation', () => {
  beforeEach(() => likeMovieMock.mockReset());

  it('calls likeMovie and invalidates like-status/liked-movies queries on success', async () => {
    likeMovieMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useLikeMutation(), { wrapper });
    result.current.mutate({ movie_id: 5 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(likeMovieMock).toHaveBeenCalledWith({ movie_id: 5 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['like', 5] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myLikedMovies'] });
  });
});
