import { useMutation } from '@tanstack/react-query';
import { register } from '../api/auth.api';
import type { RegisterVariables } from '../types/auth.types';

export function useRegister() {
  return useMutation({
    mutationFn: ({ email, password, c_password }: RegisterVariables) => register(email, password, c_password),
  });
}
