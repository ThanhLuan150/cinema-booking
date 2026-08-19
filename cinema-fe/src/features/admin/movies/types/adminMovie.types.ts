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
}

export interface CreateMoviePayload extends MovieFormValues {
  categoryIds: number[];
  directorIds: number[];
  actors: MovieActorDraft[];
  avatarFile?: File | null;
  trailerFile?: File | null;
  producerAvatarFile?: File | null;
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
}

export interface AdminMoviesState {
  showAddModal: boolean;
  showEditModal: boolean;
  showScheduleModal: boolean;
  activeMovieId: number | null;
}
