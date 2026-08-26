import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  assignMaintenanceRequest,
  closeMaintenanceRequest,
  createMaintenanceRequest,
  deleteMaintenanceRequest,
  resolveMaintenanceRequest,
  startMaintenanceRequest,
  type CreateMaintenanceRequestPayload,
} from '../api/owner.api';
import { ownerMaintenanceQueryKey } from './useOwnerMaintenance';

function invalidateMaintenance(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ownerMaintenanceQueryKey });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMaintenanceRequestPayload) => createMaintenanceRequest(payload),
    onSuccess: () => invalidateMaintenance(queryClient),
  });
}

export function useAssignMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee_id }: { id: number | string; employee_id: number }) =>
      assignMaintenanceRequest(id, { employee_id }),
    onSuccess: () => invalidateMaintenance(queryClient),
  });
}

export function useStartMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => startMaintenanceRequest(id),
    onSuccess: () => invalidateMaintenance(queryClient),
  });
}

export function useResolveMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution_note }: { id: number | string; resolution_note?: string }) =>
      resolveMaintenanceRequest(id, { resolution_note }),
    onSuccess: () => invalidateMaintenance(queryClient),
  });
}

export function useCloseMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => closeMaintenanceRequest(id),
    onSuccess: () => invalidateMaintenance(queryClient),
  });
}

export function useDeleteMaintenanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteMaintenanceRequest(id),
    onSuccess: () => invalidateMaintenance(queryClient),
  });
}
