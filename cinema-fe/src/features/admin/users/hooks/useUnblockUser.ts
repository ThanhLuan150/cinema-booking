import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unblockUser } from '../api/users.api';
import { adminUsersQueryKey } from './useAdminUsers';

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number | string; status: number }) => unblockUser(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}
