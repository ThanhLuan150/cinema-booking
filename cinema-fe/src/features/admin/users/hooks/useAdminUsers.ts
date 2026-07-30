import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getUsers } from '../api/users.api';

export const adminUsersQueryKey = ['adminUsers'] as const;

export function useAdminUsers(page: number, limit: number) {
  return useQuery({
    queryKey: [...adminUsersQueryKey, page, limit],
    queryFn: () => getUsers({ page, limit }),
    placeholderData: keepPreviousData,
  });
}
