export interface DirectorFormValues {
  full_name: string;
  avatar_url: string;
  bio: string;
  dob: string;
  nationality: string;
}

export interface CreateDirectorPayload extends DirectorFormValues {
  avatarFile?: File | null;
}

export interface AdminDirectorsState {
  showAddModal: boolean;
}
