import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCinema } from '../api/owner.api';
import { myCinemasQueryKey } from './useMyCinemas';
import type { CinemaFormValues } from '../types/owner.types';

export function useCreateCinema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CinemaFormValues) => createCinema(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myCinemasQueryKey }),
  });
}
