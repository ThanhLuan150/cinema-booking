import apiClient from 'services/apiClient';
import type { Movie } from '@/types/entities';
import type { MovieFormValues } from '../types/adminMovie.types';

// Management listing: admin sees every movie, a theater owner only sees the ones they added.
export const getMyMovies = () => apiClient.get<Movie[]>('/movie/mine').then((res) => res.data);

export const getMovieCategoriesByMovieId = (id: number | string) =>
  apiClient.get<number[]>(`/movieCat/${id}`).then((res) => res.data);

export const createMovie = (payload: MovieFormValues) => apiClient.post<{ id: number }>('/movie', payload);

export const addMovieCategory = (payload: { movie_id: number | string; cat_id: number }) =>
  apiClient.post('/movieCat', payload);

export const updateMovie = (id: number | string, payload: MovieFormValues) => apiClient.put(`/movie/${id}`, payload);

export const deleteMovie = (id: number | string) => apiClient.delete(`/movie/${id}`);

export const deleteMovieCategoryByMovieId = (id: number | string) => apiClient.delete(`/movieCat/${id}`);
