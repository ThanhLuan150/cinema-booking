import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateMovieMock = vi.fn();
const addMovieCategoryMock = vi.fn();
const deleteMovieCategoryByMovieIdMock = vi.fn();
const addMovieDirectorMock = vi.fn();
const deleteMovieDirectorByMovieIdMock = vi.fn();
const addMovieActorMock = vi.fn();
const deleteMovieActorByMovieIdMock = vi.fn();
const buildMovieFormDataMock = vi.fn();
vi.mock('../api/movies.api', () => ({
  updateMovie: (...args: unknown[]) => updateMovieMock(...args),
  addMovieCategory: (...args: unknown[]) => addMovieCategoryMock(...args),
  deleteMovieCategoryByMovieId: (...args: unknown[]) => deleteMovieCategoryByMovieIdMock(...args),
  addMovieDirector: (...args: unknown[]) => addMovieDirectorMock(...args),
  deleteMovieDirectorByMovieId: (...args: unknown[]) => deleteMovieDirectorByMovieIdMock(...args),
  addMovieActor: (...args: unknown[]) => addMovieActorMock(...args),
  deleteMovieActorByMovieId: (...args: unknown[]) => deleteMovieActorByMovieIdMock(...args),
  buildMovieFormData: (...args: unknown[]) => buildMovieFormDataMock(...args),
}));

import { useUpdateMovie } from './useUpdateMovie';

describe('useUpdateMovie', () => {
  beforeEach(() => {
    updateMovieMock.mockReset();
    addMovieCategoryMock.mockReset();
    deleteMovieCategoryByMovieIdMock.mockReset();
    addMovieDirectorMock.mockReset();
    deleteMovieDirectorByMovieIdMock.mockReset();
    addMovieActorMock.mockReset();
    deleteMovieActorByMovieIdMock.mockReset();
    buildMovieFormDataMock.mockReset();
  });

  it('updates the movie, replaces categories/directors/actors, and invalidates related queries', async () => {
    const formData = new FormData();
    buildMovieFormDataMock.mockReturnValue(formData);
    updateMovieMock.mockResolvedValue({});
    deleteMovieCategoryByMovieIdMock.mockResolvedValue({});
    addMovieCategoryMock.mockResolvedValue({});
    deleteMovieDirectorByMovieIdMock.mockResolvedValue({});
    addMovieDirectorMock.mockResolvedValue({});
    deleteMovieActorByMovieIdMock.mockResolvedValue({});
    addMovieActorMock.mockResolvedValue({});

    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useUpdateMovie(), { wrapper });
    result.current.mutate({
      id: 5,
      values: { name: 'Updated' },
      categoryIds: [3],
      directorIds: [7],
      actors: [{ actor_id: 9, character_name: 'Hero', is_lead: false }],
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateMovieMock).toHaveBeenCalledWith(5, formData);
    expect(deleteMovieCategoryByMovieIdMock).toHaveBeenCalledWith(5);
    expect(addMovieCategoryMock).toHaveBeenCalledWith({ movie_id: 5, cat_id: 3 });
    expect(deleteMovieDirectorByMovieIdMock).toHaveBeenCalledWith(5);
    expect(addMovieDirectorMock).toHaveBeenCalledWith({ movie_id: 5, director_id: 7 });
    expect(deleteMovieActorByMovieIdMock).toHaveBeenCalledWith(5);
    expect(addMovieActorMock).toHaveBeenCalledWith({
      movie_id: 5,
      actor_id: 9,
      character_name: 'Hero',
      is_lead: false,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movies'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myMovies'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movie', 5] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieCategories', 5] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieDirectors', 5] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieActors', 5] });
  });
});
