import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createActor, deleteActor, buildActorFormData } from '../api/actors.api';
import { actorsQueryKey } from './useActors';
import type { CreateActorPayload } from '../types/actor.types';

export function useCreateActor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateActorPayload) => {
      const { avatarFile, ...values } = payload;
      return createActor(buildActorFormData(values, avatarFile));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: actorsQueryKey }),
  });
}

export function useDeleteActor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteActor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: actorsQueryKey }),
  });
}
