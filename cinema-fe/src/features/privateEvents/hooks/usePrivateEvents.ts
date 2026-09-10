import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PrivateEventStatus, EventPackageStatus } from '@/types/entities';
import {
  approvePrivateEvent,
  cancelMyPrivateEvent,
  completePrivateEvent,
  confirmPrivateEvent,
  getEventPackages,
  getMyPrivateEvents,
  getPrivateEvents,
  payPrivateEvent,
  quotePrivateEvent,
  rejectPrivateEvent,
  requestPrivateEvent,
  type PrivateEventRequestPayload,
} from '../api/privateEvents.api';

export const privateEventKeys = {
  packages: ['eventPackages'] as const,
  mine: ['myPrivateEvents'] as const,
  admin: ['adminPrivateEvents'] as const,
};

export function useEventPackages(status: EventPackageStatus | undefined = 'ACTIVE') {
  return useQuery({
    queryKey: [...privateEventKeys.packages, status ?? 'ALL'],
    queryFn: () => getEventPackages({ status, limit: 100 }),
  });
}

export function useMyPrivateEvents(page: number, limit: number, status?: PrivateEventStatus) {
  return useQuery({
    queryKey: [...privateEventKeys.mine, page, limit, status ?? 'ALL'],
    queryFn: () => getMyPrivateEvents({ page, limit, status }),
    placeholderData: keepPreviousData,
  });
}

export function usePrivateEventsAdmin(
  branchId: number | string | undefined,
  page: number,
  limit: number,
  status?: PrivateEventStatus,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...privateEventKeys.admin, branchId ?? 'ALL', page, limit, status ?? 'ALL'],
    queryFn: () => getPrivateEvents(branchId, { page, limit, status }),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

// ---- Mutations --------------------------------------------------------

export function useRequestPrivateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PrivateEventRequestPayload) => requestPrivateEvent(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: privateEventKeys.mine }),
  });
}

function useCustomerAction<T>(fn: (id: number | string, arg?: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arg }: { id: number | string; arg?: T }) => fn(id, arg),
    onSuccess: () => qc.invalidateQueries({ queryKey: privateEventKeys.mine }),
  });
}

export const usePayPrivateEvent = () => useCustomerAction((id) => payPrivateEvent(id));
export const useCancelMyPrivateEvent = () =>
  useCustomerAction<string>((id, reason) => cancelMyPrivateEvent(id, reason));

function useAdminAction<T>(fn: (id: number | string, arg?: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arg }: { id: number | string; arg?: T }) => fn(id, arg),
    onSuccess: () => qc.invalidateQueries({ queryKey: privateEventKeys.admin }),
  });
}

export const useQuotePrivateEvent = () =>
  useAdminAction<{ amount: number; notes?: string }>((id, arg) =>
    quotePrivateEvent(id, arg!.amount, arg!.notes),
  );
export const useApprovePrivateEvent = () => useAdminAction((id) => approvePrivateEvent(id));
export const useConfirmPrivateEvent = () => useAdminAction((id) => confirmPrivateEvent(id));
export const useCompletePrivateEvent = () => useAdminAction((id) => completePrivateEvent(id));
export const useRejectPrivateEvent = () =>
  useAdminAction<string>((id, reason) => rejectPrivateEvent(id, reason));
