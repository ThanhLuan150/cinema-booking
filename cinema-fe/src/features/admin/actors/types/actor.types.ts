export interface ActorFormValues {
  full_name: string;
  avatar_url: string;
  bio: string;
  dob: string;
  nationality: string;
}

export interface CreateActorPayload extends ActorFormValues {
  avatarFile?: File | null;
}

export interface AdminActorsState {
  showAddModal: boolean;
}
