import { useQuery } from '@tanstack/react-query';
import { getUserById } from '../api/users.api';

export function useAdminUserById(id: number | string | undefined) {
  return useQuery({
    queryKey: ['adminUser', id],
    queryFn: () => getUserById(id as number | string),
    enabled: !!id,
  });
}
