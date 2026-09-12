import { ROLES } from '@/constants/roles';

export const ROLE_KEY: Record<number, string> = {
  [ROLES.admin]: 'admin',
  [ROLES.customer]: 'user',
  [ROLES.owner]: 'theater',
  [ROLES.employee]: 'employee',
};
