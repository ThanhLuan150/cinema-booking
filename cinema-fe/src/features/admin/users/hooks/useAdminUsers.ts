import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../api/users.api';

export const adminUsersQueryKey = ['adminUsers'] as const;

export function useAdminUsers() {
  return useQuery({
    queryKey: adminUsersQueryKey,
    queryFn: getUsers,
  });
}
