import { useMutation } from '@tanstack/react-query';
import { checkEmailExists } from '../api/auth.api';

export function useCheckEmail() {
  return useMutation({
    mutationFn: (email: string) => checkEmailExists(email),
  });
}
