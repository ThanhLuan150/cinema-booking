export interface CastMemberDraft {
  name: string;
  role: string;
  avatar: string;
}

export interface MovieFormValues {
  name: string;
  avatar: string;
  premiere_date: string;
  description: string;
  country: string;
  trailer: string;
  producer: string;
  director: string;
  cast: CastMemberDraft[];
}

export interface CreateMoviePayload extends Omit<MovieFormValues, 'cast'> {
  cast: CastMemberDraft[];
  categoryIds: number[];
}

export interface UpdateMoviePayload {
  id: number | string;
  values: MovieFormValues;
  categoryIds: number[];
}

export interface AdminMoviesState {
  showAddModal: boolean;
  showEditModal: boolean;
  showScheduleModal: boolean;
  activeMovieId: number | null;
}
