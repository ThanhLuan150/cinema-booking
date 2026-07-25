import { useMutation } from '@tanstack/react-query';
import { saveUserInfo } from '../api/auth.api';
import type { SaveUserInfoPayload } from '../types/auth.types';

export function useSaveUserInfo() {
  return useMutation({
    mutationFn: (payload: SaveUserInfoPayload) => saveUserInfo(payload),
  });
}
