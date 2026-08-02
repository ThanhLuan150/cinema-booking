import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import * as moviesApi from './movies.api';

describe('movies.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getMovies merges filters and pagination into params', async () => {
    await moviesApi.getMovies({ search: 'matrix' } as any, { page: 2, limit: 10 } as any);
    expect(getMock).toHaveBeenCalledWith('/movie', { params: { search: 'matrix', page: 2, limit: 10 } });
  });

  it('getMovieById gets /movie/:id', async () => {
    await moviesApi.getMovieById(5);
    expect(getMock).toHaveBeenCalledWith('/movie/5');
  });

  it('getCategoriesList gets /cat', async () => {
    await moviesApi.getCategoriesList();
    expect(getMock).toHaveBeenCalledWith('/cat');
  });

  it('getCinemasList gets /cinema with pagination params', async () => {
    await moviesApi.getCinemasList({ limit: 100 } as any);
    expect(getMock).toHaveBeenCalledWith('/cinema', { params: { limit: 100 } });
  });

  it('getCinemaById gets /cinema/:id', async () => {
    await moviesApi.getCinemaById(3);
    expect(getMock).toHaveBeenCalledWith('/cinema/3');
  });

  it('getCinemaFavoriteCount gets /cinema/:id/favorite', async () => {
    await moviesApi.getCinemaFavoriteCount(3);
    expect(getMock).toHaveBeenCalledWith('/cinema/3/favorite');
  });

  it('getLikeStatus gets /like/:id', async () => {
    await moviesApi.getLikeStatus(3);
    expect(getMock).toHaveBeenCalledWith('/like/3');
  });

  it('likeMovie posts to /like', async () => {
    const payload = { movie_id: 1 };
    await moviesApi.likeMovie(payload);
    expect(postMock).toHaveBeenCalledWith('/like', payload);
  });

  it('unlikeMovie posts to /unlike', async () => {
    const payload = { movie_id: 1 };
    await moviesApi.unlikeMovie(payload);
    expect(postMock).toHaveBeenCalledWith('/unlike', payload);
  });

  it('getMyLikedMovies gets /like/mine', async () => {
    await moviesApi.getMyLikedMovies();
    expect(getMock).toHaveBeenCalledWith('/like/mine');
  });

  it('getMyFavoriteCinemas gets /cinema/favorites/mine', async () => {
    await moviesApi.getMyFavoriteCinemas();
    expect(getMock).toHaveBeenCalledWith('/cinema/favorites/mine');
  });

  it('favoriteCinema posts to /cinema/favorite', async () => {
    await moviesApi.favoriteCinema(7);
    expect(postMock).toHaveBeenCalledWith('/cinema/favorite', { cinema_id: 7 });
  });

  it('unfavoriteCinema posts to /cinema/unfavorite', async () => {
    await moviesApi.unfavoriteCinema(7);
    expect(postMock).toHaveBeenCalledWith('/cinema/unfavorite', { cinema_id: 7 });
  });

  it('getTopCinemas gets /cinema/top', async () => {
    await moviesApi.getTopCinemas();
    expect(getMock).toHaveBeenCalledWith('/cinema/top');
  });
});
