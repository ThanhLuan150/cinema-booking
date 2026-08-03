import { useMutation } from '@tanstack/react-query';
import { saveCinemaInfo } from '../api/auth.api';

export function useSaveCinemaInfo() {
  return useMutation({
    mutationFn: (payload: FormData) => saveCinemaInfo(payload),
  });
}
