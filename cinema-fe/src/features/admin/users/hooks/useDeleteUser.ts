import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteUser } from '../api/users.api';
import { adminUsersQueryKey } from './useAdminUsers';

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}
