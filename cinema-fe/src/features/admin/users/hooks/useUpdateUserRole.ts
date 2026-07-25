import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserRole } from '../api/users.api';
import { adminUsersQueryKey } from './useAdminUsers';

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number | string; role: number }) => updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    },
  });
}
