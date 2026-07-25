import { useMutation, useQueryClient } from '@tanstack/react-query';
import { blockUser } from '../api/users.api';
import { adminUsersQueryKey } from './useAdminUsers';

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => blockUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}
