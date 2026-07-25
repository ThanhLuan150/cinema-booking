import { useMutation } from '@tanstack/react-query';
import { verifyCode } from '../api/auth.api';
import type { VerifyCodePayload } from '../types/auth.types';

export function useVerifyCode() {
  return useMutation({
    mutationFn: (payload: VerifyCodePayload) => verifyCode(payload),
  });
}
