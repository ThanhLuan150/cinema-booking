import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveCinema, blockCinema, deleteCinema } from '../api/cinemas.api';
import { adminCinemasQueryKey } from './useAdminCinemas';

export function useApproveCinema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => approveCinema(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey }),
  });
}

export function useBlockCinema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => blockCinema(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey }),
  });
}

export function useDeleteCinema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteCinema(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey }),
  });
}
