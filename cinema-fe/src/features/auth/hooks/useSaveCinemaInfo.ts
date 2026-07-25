import { useMutation } from '@tanstack/react-query';
import { saveCinemaInfo } from '../api/auth.api';
import type { SaveCinemaInfoPayload } from '../types/auth.types';

export function useSaveCinemaInfo() {
  return useMutation({
    mutationFn: (payload: SaveCinemaInfoPayload) => saveCinemaInfo(payload),
  });
}
