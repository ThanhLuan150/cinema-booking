import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDirector, deleteDirector, buildDirectorFormData } from '../api/directors.api';
import { directorsQueryKey } from './useDirectors';
import type { CreateDirectorPayload } from '../types/director.types';

export function useCreateDirector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDirectorPayload) => {
      const { avatarFile, ...values } = payload;
      return createDirector(buildDirectorFormData(values, avatarFile));
    },
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
