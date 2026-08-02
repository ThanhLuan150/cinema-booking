import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const deleteMovieMock = vi.fn();
const deleteMovieCategoryByMovieIdMock = vi.fn();
vi.mock('../api/movies.api', () => ({
  deleteMovie: (...args: unknown[]) => deleteMovieMock(...args),
  deleteMovieCategoryByMovieId: (...args: unknown[]) => deleteMovieCategoryByMovieIdMock(...args),
}));

import { useDeleteMovie } from './useDeleteMovie';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('useDeleteMovie', () => {
  beforeEach(() => {
    deleteMovieMock.mockReset();
    deleteMovieCategoryByMovieIdMock.mockReset();
  });

  it('deletes the movie and its category mappings, then invalidates lists', async () => {
    deleteMovieMock.mockResolvedValue({});
    deleteMovieCategoryByMovieIdMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteMovie(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteMovieMock).toHaveBeenCalledWith(5);
    expect(deleteMovieCategoryByMovieIdMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movies'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myMovies'] });
  });

  it('does not fail the mutation when deleting categories errors', async () => {
    deleteMovieMock.mockResolvedValue({});
    deleteMovieCategoryByMovieIdMock.mockRejectedValue(new Error('already gone'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteMovie(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
