export interface CastMemberDraft {
  name: string;
  role: string;
  avatar: string;
  isLead: boolean;
}

export interface MovieFormValues {
  name: string;
  avatar: string;
  premiere_date: string;
  description: string;
  country: string;
  trailer: string;
  producer: string;
  producerAvatar: string;
  director: string;
  directorAvatar: string;
  cast: CastMemberDraft[];
}

export interface CreateMoviePayload extends Omit<MovieFormValues, 'cast'> {
  cast: CastMemberDraft[];
  categoryIds: number[];
  avatarFile?: File | null;
  trailerFile?: File | null;
}

export interface UpdateMoviePayload {
  id: number | string;
  values: MovieFormValues;
  categoryIds: number[];
  avatarFile?: File | null;
  trailerFile?: File | null;
}

export interface AdminMoviesState {
  showAddModal: boolean;
  showEditModal: boolean;
  showScheduleModal: boolean;
  activeMovieId: number | null;
}
