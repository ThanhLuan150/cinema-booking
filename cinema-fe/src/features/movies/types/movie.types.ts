import type { Cinema } from '@/types/entities';

export type { Movie, Category, MovieCategory } from '@/types/entities';

export interface MovieFilters {
  search?: string;
  category?: string | number;
  country?: string;
  date?: string;
  cinema?: string | number;
  status?: 'playing' | 'upcoming';
}

export interface MoviesState {
  filters: MovieFilters;
}

export interface LikePayload {
  movie_id: string | number;
}

export interface TopCinema extends Cinema {
  bookingCount: number;
  avgRating: number;
  reviewCount: number;
}
