import { useMutation } from '@tanstack/react-query';
import { getAccountsByEmail, resendCode } from '../api/auth.api';

export function useResendCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await getAccountsByEmail(email);
      if (response.data.length > 0) {
        return resendCode(response.data[0].id);
      }
      return null;
    },
  });
}
