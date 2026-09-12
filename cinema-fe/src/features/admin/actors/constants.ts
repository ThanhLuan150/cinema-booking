import type { ActorFormValues } from './types/actor.types';

export const emptyForm = (): ActorFormValues => ({
  full_name: '',
  avatar_url: '',
  bio: '',
  dob: '',
  nationality: '',
});
