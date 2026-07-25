export const ROLES = {
  admin: 0,
  customer: 1,
  owner: 2,
} as const;

export const ADMIN_ONLY_ROLES: number[] = [ROLES.admin];
export const MANAGEMENT_ROLES: number[] = [ROLES.admin, ROLES.owner];
