export interface ActorFormValues {
  full_name: string;
  avatar_url: string;
  bio: string;
  dob: string;
  nationality: string;
}

export interface AdminActorsState {
  showAddModal: boolean;
}
