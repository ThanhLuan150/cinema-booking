import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createActor, deleteActor } from '../api/actors.api';
import { actorsQueryKey } from './useActors';
import type { ActorFormValues } from '../types/actor.types';

export function useCreateActor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ActorFormValues) => createActor(payload),
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
