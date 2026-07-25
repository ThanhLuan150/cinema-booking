import { useMutation } from '@tanstack/react-query';
import { changePassword } from '../api/auth.api';

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string; c_password: string }) =>
      changePassword(payload),
  });
}
