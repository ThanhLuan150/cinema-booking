import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  Distributor,
  DistributorStatus,
  MovieRelease,
  MovieReleaseStatus,
} from '@/types/entities';

/* ------------------------------- Distributors ------------------------------- */

export interface DistributorFilters {
  status?: DistributorStatus | '';
  search?: string;
}

export interface DistributorPayload {
  name: string;
  code: string;
  contact_email?: string;
  phone?: string;
  status?: DistributorStatus;
}

export const getDistributors = (params?: PaginationParams & DistributorFilters) =>
  apiClient.get<PaginatedResponse<Distributor>>('/distributors', { params }).then((res) => res.data);

export const getAllDistributors = (status?: DistributorStatus) =>
  apiClient
    .get<Distributor[]>('/distributors/all', { params: status ? { status } : undefined })
    .then((res) => res.data);

export const createDistributor = (payload: DistributorPayload) =>
  apiClient.post<Distributor>('/distributors', payload).then((res) => res.data);

export const updateDistributor = (id: number | string, payload: Partial<DistributorPayload>) =>
  apiClient.put<Distributor>(`/distributors/${id}`, payload).then((res) => res.data);

export const deleteDistributor = (id: number | string) => apiClient.delete(`/distributors/${id}`);

/* ------------------------------ Movie releases ------------------------------ */

export interface MovieReleaseFilters {
  movieId?: number | string;
  distributorId?: number | string;
  status?: MovieReleaseStatus | '';
}

export interface MovieReleasePayload {
  movie_id: number;
  distributor_id: number;
  release_date: string;
  end_date?: string | null;
  status?: MovieReleaseStatus;
}

export const getMovieReleases = (params?: PaginationParams & MovieReleaseFilters) =>
  apiClient.get<PaginatedResponse<MovieRelease>>('/movie-releases', { params }).then((res) => res.data);

export const createMovieRelease = (payload: MovieReleasePayload) =>
  apiClient.post<MovieRelease>('/movie-releases', payload).then((res) => res.data);

export const updateMovieRelease = (id: number | string, payload: Partial<MovieReleasePayload>) =>
  apiClient.put<MovieRelease>(`/movie-releases/${id}`, payload).then((res) => res.data);

export const deleteMovieRelease = (id: number | string) => apiClient.delete(`/movie-releases/${id}`);
