import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as moviesApi from './movies.api';

describe('admin movies.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  describe('buildMovieFormData', () => {
    it('appends scalar values and files', () => {
      const formData = moviesApi.buildMovieFormData(
        { name: 'Movie A', premiere_date: '2026-01-01' } as any,
        new File(['x'], 'avatar.png'),
        null,
      );
      expect(formData.get('name')).toBe('Movie A');
      expect(formData.get('premiere_date')).toBe('2026-01-01');
      expect(formData.get('avatar')).toBeInstanceOf(File);
      expect(formData.get('trailer')).toBeNull();
    });

    it('skips undefined/null values', () => {
      const formData = moviesApi.buildMovieFormData({ name: 'A', description: undefined } as any);
      expect(formData.has('description')).toBe(false);
    });
  });

  it('getMyMovies gets /movie/mine', async () => {
    await moviesApi.getMyMovies({ page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/movie/mine', { params: { page: 1 } });
  });

  it('getMovieCategoriesByMovieId gets /movieCat/:id', async () => {
    await moviesApi.getMovieCategoriesByMovieId(5);
    expect(getMock).toHaveBeenCalledWith('/movieCat/5');
  });

  it('createMovie posts FormData to /movie', async () => {
    const formData = new FormData();
    await moviesApi.createMovie(formData);
    expect(postMock).toHaveBeenCalledWith('/movie', formData);
  });

  it('addMovieCategory posts to /movieCat', async () => {
    const payload = { movie_id: 1, cat_id: 2 };
    await moviesApi.addMovieCategory(payload);
    expect(postMock).toHaveBeenCalledWith('/movieCat', payload);
  });

  it('updateMovie puts FormData to /movie/:id', async () => {
    const formData = new FormData();
    await moviesApi.updateMovie(5, formData);
    expect(putMock).toHaveBeenCalledWith('/movie/5', formData);
  });

  it('deleteMovie deletes /movie/:id', async () => {
    await moviesApi.deleteMovie(5);
    expect(deleteMock).toHaveBeenCalledWith('/movie/5');
  });

  it('deleteMovieCategoryByMovieId deletes /movieCat/:id', async () => {
    await moviesApi.deleteMovieCategoryByMovieId(5);
    expect(deleteMock).toHaveBeenCalledWith('/movieCat/5');
  });

  it('getMovieDirectorsByMovieId gets /movieDirector/:id', async () => {
    await moviesApi.getMovieDirectorsByMovieId(5);
    expect(getMock).toHaveBeenCalledWith('/movieDirector/5');
  });

  it('addMovieDirector posts to /movieDirector', async () => {
    const payload = { movie_id: 1, director_id: 2 };
    await moviesApi.addMovieDirector(payload);
    expect(postMock).toHaveBeenCalledWith('/movieDirector', payload);
  });

  it('deleteMovieDirectorByMovieId deletes /movieDirector/:id', async () => {
    await moviesApi.deleteMovieDirectorByMovieId(5);
    expect(deleteMock).toHaveBeenCalledWith('/movieDirector/5');
  });

  it('getMovieActorsByMovieId gets /movieActor/:id', async () => {
    await moviesApi.getMovieActorsByMovieId(5);
    expect(getMock).toHaveBeenCalledWith('/movieActor/5');
  });

  it('addMovieActor posts to /movieActor', async () => {
    const payload = { movie_id: 1, actor_id: 2, character_name: 'Hero', is_lead: true };
    await moviesApi.addMovieActor(payload);
    expect(postMock).toHaveBeenCalledWith('/movieActor', payload);
  });

  it('deleteMovieActorByMovieId deletes /movieActor/:id', async () => {
    await moviesApi.deleteMovieActorByMovieId(5);
    expect(deleteMock).toHaveBeenCalledWith('/movieActor/5');
  });
});
