import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmInSeatMomoPayment,
  createInSeatOrder,
  getInSeatOrder,
  getInSeatSession,
  getSeatQrSheet,
} from '../api/inSeat.api';
import type { CreateInSeatOrderPayload, InSeatOrderStatus } from '../types/inSeat.types';

// Root key for everything the customer's in-seat screens show. RealtimeBridge invalidates it on
// comboOrder:updated / payment:updated, so a status change in the kitchen reaches the phone at once.
export const inSeatQueryKey = ['inSeat'] as const;
export const inSeatSessionQueryKey = (qr: string) => [...inSeatQueryKey, 'session', qr] as const;
export const inSeatOrderQueryKey = (code: string) => [...inSeatQueryKey, 'order', code] as const;
export const seatQrSheetQueryKey = (scheduleId: number) => ['seatQrSheet', scheduleId] as const;

const ACTIVE_STATUSES: InSeatOrderStatus[] = ['PENDING', 'PAID', 'PREPARING', 'READY'];
// Realtime does the work; this poll only covers a dropped socket while an order is still moving.
const SAFETY_POLL_MS = 30_000;

export function useInSeatSession(qr: string | null) {
  return useQuery({
    queryKey: inSeatSessionQueryKey(qr ?? ''),
    queryFn: () => getInSeatSession(qr as string),
    enabled: Boolean(qr),
    retry: false,
  });
}

export function useCreateInSeatOrder() {
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateInSeatOrderPayload;
      idempotencyKey: string;
    }) => createInSeatOrder(payload, idempotencyKey),
  });
}

export function useConfirmInSeatPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, params }: { code: string; params: Record<string, string> }) =>
      confirmInSeatMomoPayment(code, params),
    onSuccess: (data) => {
      queryClient.setQueryData(inSeatOrderQueryKey(data.order.code), data.order);
      queryClient.invalidateQueries({ queryKey: inSeatQueryKey });
    },
  });
}

export function useInSeatOrder(code: string | undefined) {
  return useQuery({
    queryKey: inSeatOrderQueryKey(code ?? ''),
    queryFn: () => getInSeatOrder(code as string),
    enabled: Boolean(code),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && ACTIVE_STATUSES.includes(query.state.data.status)
        ? SAFETY_POLL_MS
        : false,
  });
}

export function useSeatQrSheet(scheduleId: number | null) {
  return useQuery({
    queryKey: seatQrSheetQueryKey(scheduleId ?? 0),
    queryFn: () => getSeatQrSheet(scheduleId as number),
    enabled: scheduleId !== null,
    retry: false,
  });
}
