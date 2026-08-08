import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createMovieMock = vi.fn();
const addMovieCategoryMock = vi.fn();
const addMovieDirectorMock = vi.fn();
const addMovieActorMock = vi.fn();
const buildMovieFormDataMock = vi.fn();
vi.mock('../api/movies.api', () => ({
  createMovie: (...args: unknown[]) => createMovieMock(...args),
  addMovieCategory: (...args: unknown[]) => addMovieCategoryMock(...args),
  addMovieDirector: (...args: unknown[]) => addMovieDirectorMock(...args),
  addMovieActor: (...args: unknown[]) => addMovieActorMock(...args),
  buildMovieFormData: (...args: unknown[]) => buildMovieFormDataMock(...args),
}));

import { useCreateMovie } from './useCreateMovie';

describe('useCreateMovie', () => {
  beforeEach(() => {
    createMovieMock.mockReset();
    addMovieCategoryMock.mockReset();
    addMovieDirectorMock.mockReset();
    addMovieActorMock.mockReset();
    buildMovieFormDataMock.mockReset();
  });

  it('creates the movie then adds each selected category, director and actor', async () => {
    const formData = new FormData();
    buildMovieFormDataMock.mockReturnValue(formData);
    createMovieMock.mockResolvedValue({ data: { id: 42 } });
    addMovieCategoryMock.mockResolvedValue({});
    addMovieDirectorMock.mockResolvedValue({});
    addMovieActorMock.mockResolvedValue({});

    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useCreateMovie(), { wrapper });
    result.current.mutate({
      name: 'Movie A',
      premiere_date: '2026-01-01',
      categoryIds: [1, 2],
      directorIds: [7],
      actors: [{ actor_id: 9, character_name: 'Hero', is_lead: true }],
    } as any);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createMovieMock).toHaveBeenCalledWith(formData);
    expect(addMovieCategoryMock).toHaveBeenCalledWith({ movie_id: 42, cat_id: 1 });
    expect(addMovieCategoryMock).toHaveBeenCalledWith({ movie_id: 42, cat_id: 2 });
    expect(addMovieDirectorMock).toHaveBeenCalledWith({ movie_id: 42, director_id: 7 });
    expect(addMovieActorMock).toHaveBeenCalledWith({
      movie_id: 42,
      actor_id: 9,
      character_name: 'Hero',
      is_lead: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movies'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myMovies'] });
  });
});
