import { useMutation } from '@tanstack/react-query';
import { resetPassword } from '../api/auth.api';

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { email: string; otp: string; password: string; c_password: string }) =>
      resetPassword(payload),
  });
}
