import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveUser } from '../api/users.api';
import { adminUsersQueryKey } from './useAdminUsers';

export function useApproveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => approveUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}
