import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDirector, deleteDirector } from '../api/directors.api';
import { directorsQueryKey } from './useDirectors';
import type { DirectorFormValues } from '../types/director.types';

export function useCreateDirector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DirectorFormValues) => createDirector(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: directorsQueryKey }),
  });
}

export function useDeleteDirector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteDirector(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: directorsQueryKey }),
  });
}
