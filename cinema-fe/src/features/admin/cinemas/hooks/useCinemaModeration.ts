import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activateCinema, disableCinema, setCinemaMaintenance, deleteCinema, createBranchAdmin } from '../api/cinemas.api';
import { adminCinemasQueryKey } from './useAdminCinemas';
import type { CreateBranchAdminPayload } from '../types/cinemas.types';

export function useActivateCinema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => activateCinema(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey }),
  });
}

export function useDisableCinema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => disableCinema(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey }),
  });
}

export function useSetCinemaMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => setCinemaMaintenance(id),
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

export function useCreateBranchAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBranchAdminPayload) => createBranchAdmin(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey }),
  });
}
