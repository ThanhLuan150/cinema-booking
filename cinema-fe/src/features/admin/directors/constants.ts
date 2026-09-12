import type { DirectorFormValues } from './types/director.types';

export const emptyForm = (): DirectorFormValues => ({
  full_name: '',
  avatar_url: '',
  bio: '',
  dob: '',
  nationality: '',
});
