export const ROLES = {
  admin: 0,
  customer: 1,
  owner: 2,
  employee: 3,
} as const;

export const ADMIN_ONLY_ROLES: number[] = [ROLES.admin];
export const MANAGEMENT_ROLES: number[] = [ROLES.admin, ROLES.owner];
export const EMPLOYEE_ONLY_ROLES: number[] = [ROLES.employee];
// Counter-sale/check-in style actions any cinema staff member can perform.
export const STAFF_ROLES: number[] = [ROLES.admin, ROLES.owner, ROLES.employee];
