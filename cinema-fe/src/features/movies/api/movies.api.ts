import apiClient from 'services/apiClient';
import type { Movie, Category, Cinema } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { LikePayload, MovieFilters, TopCinema } from '../types/movie.types';

export const getMovies = (filters?: MovieFilters, pagination?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<Movie>>('/movie', { params: { ...filters, ...pagination } })
    .then((res) => res.data);

export const getMovieById = (id: string | number) =>
  apiClient.get(`/movie/${id}`).then((res) => res.data as Movie);

export const getCategoriesList = () => apiClient.get('/cat').then((res) => res.data as Category[]);

export const getCinemasList = (pagination?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Cinema>>('/cinema', { params: pagination }).then((res) => res.data);

export const getCinemaById = (id: string | number) => apiClient.get(`/cinema/${id}`).then((res) => res.data as Cinema);

export const getCinemaFavoriteCount = (id: string | number) =>
  apiClient.get(`/cinema/${id}/favorite`).then((res) => res.data as number);

export const getLikeStatus = (id: string | number) =>
  apiClient.get(`/like/${id}`).then((res) => res.data as number);

export const likeMovie = (payload: LikePayload) => apiClient.post('/like', payload);

export const unlikeMovie = (payload: LikePayload) => apiClient.post('/unlike', payload);

export const getMyLikedMovies = () =>
  apiClient.get('/like/mine').then((res) => res.data as Pick<Movie, 'id' | 'name' | 'avatar' | 'categories'>[]);

export const getMyFavoriteCinemas = () =>
  apiClient.get('/cinema/favorites/mine').then((res) => res.data as Cinema[]);

export const favoriteCinema = (branchId: number) => apiClient.post('/cinema/favorite', { cinema_id: branchId });

export const unfavoriteCinema = (branchId: number) => apiClient.post('/cinema/unfavorite', { cinema_id: branchId });

export const getTopCinemas = () => apiClient.get('/cinema/top').then((res) => res.data as TopCinema[]);
