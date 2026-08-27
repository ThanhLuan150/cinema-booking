import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  assignSupportTicket,
  claimSupportTicket,
  closeSupportTicket,
  createSupportTicket,
  deleteSupportTicket,
  resolveSupportTicket,
  updateSupportTicket,
  type CreateSupportTicketPayload,
} from '../api/customerService.api';
import { supportTicketsQueryKey } from './useSupportTickets';

function invalidateSupportTickets(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: supportTicketsQueryKey });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSupportTicketPayload) => createSupportTicket(payload),
    onSuccess: () => invalidateSupportTickets(queryClient),
  });
}

export function useUpdateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number | string; subject?: string; description?: string }) =>
      updateSupportTicket(id, payload),
    onSuccess: () => invalidateSupportTickets(queryClient),
  });
}

export function useClaimSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => claimSupportTicket(id),
    onSuccess: () => invalidateSupportTickets(queryClient),
  });
}

export function useAssignSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, employee_id }: { id: number | string; employee_id: number }) =>
      assignSupportTicket(id, { employee_id }),
    onSuccess: () => invalidateSupportTickets(queryClient),
  });
}

export function useResolveSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution_note }: { id: number | string; resolution_note?: string }) =>
      resolveSupportTicket(id, { resolution_note }),
    onSuccess: () => invalidateSupportTickets(queryClient),
  });
}

export function useCloseSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => closeSupportTicket(id),
    onSuccess: () => invalidateSupportTickets(queryClient),
  });
}

export function useDeleteSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteSupportTicket(id),
    onSuccess: () => invalidateSupportTickets(queryClient),
  });
}
