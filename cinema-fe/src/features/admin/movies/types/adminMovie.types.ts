import type { AgeRating } from '@/constants/ageRating';

export interface MovieActorDraft {
  actor_id: number;
  character_name: string;
  is_lead: boolean;
}

export interface MovieFormValues {
  name: string;
  avatar: string;
  duration: string;
  premiere_date: string;
  description: string;
  country: string;
  trailer: string;
  producer: string;
  producerAvatar: string;
  status?: 'ACTIVE' | 'INACTIVE';
  // Ticket 34 — Movie Content Management.
  banner: string;
  gallery: string[];
  age_rating: AgeRating;
  language: string;
  subtitle: string;
  featured: boolean;
}

export interface CreateMoviePayload extends MovieFormValues {
  categoryIds: number[];
  directorIds: number[];
  actors: MovieActorDraft[];
  avatarFile?: File | null;
  trailerFile?: File | null;
  producerAvatarFile?: File | null;
  bannerFile?: File | null;
  galleryFiles?: File[];
}

export interface UpdateMoviePayload {
  id: number | string;
  values: MovieFormValues;
  categoryIds: number[];
  directorIds: number[];
  actors: MovieActorDraft[];
  avatarFile?: File | null;
  trailerFile?: File | null;
  producerAvatarFile?: File | null;
  bannerFile?: File | null;
  galleryFiles?: File[];
}

export interface AddMovieFormValues extends MovieFormValues {
  categoryIds: number[];
  directorIds: number[];
  actors: MovieActorDraft[];
}

export interface EditMovieFormValues extends MovieFormValues {
  categoryIds: number[];
  directorIds: number[];
  actors: MovieActorDraft[];
}

export interface AdminMoviesState {
  showAddModal: boolean;
  showEditModal: boolean;
  showScheduleModal: boolean;
  activeMovieId: number | null;
}
