import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateMovieMock = vi.fn();
const addMovieCategoryMock = vi.fn();
const deleteMovieCategoryByMovieIdMock = vi.fn();
const buildMovieFormDataMock = vi.fn();
vi.mock('../api/movies.api', () => ({
  updateMovie: (...args: unknown[]) => updateMovieMock(...args),
  addMovieCategory: (...args: unknown[]) => addMovieCategoryMock(...args),
  deleteMovieCategoryByMovieId: (...args: unknown[]) => deleteMovieCategoryByMovieIdMock(...args),
  buildMovieFormData: (...args: unknown[]) => buildMovieFormDataMock(...args),
}));

import { useUpdateMovie } from './useUpdateMovie';

describe('useUpdateMovie', () => {
  beforeEach(() => {
    updateMovieMock.mockReset();
    addMovieCategoryMock.mockReset();
    deleteMovieCategoryByMovieIdMock.mockReset();
    buildMovieFormDataMock.mockReset();
  });

  it('updates the movie, replaces its categories, and invalidates related queries', async () => {
    const formData = new FormData();
    buildMovieFormDataMock.mockReturnValue(formData);
    updateMovieMock.mockResolvedValue({});
    deleteMovieCategoryByMovieIdMock.mockResolvedValue({});
    addMovieCategoryMock.mockResolvedValue({});

    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useUpdateMovie(), { wrapper });
    result.current.mutate({
      id: 5,
      values: { name: 'Updated', cast: [] },
      categoryIds: [3],
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateMovieMock).toHaveBeenCalledWith(5, formData);
    expect(deleteMovieCategoryByMovieIdMock).toHaveBeenCalledWith(5);
    expect(addMovieCategoryMock).toHaveBeenCalledWith({ movie_id: 5, cat_id: 3 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movies'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myMovies'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movie', 5] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieCategories', 5] });
  });
});
