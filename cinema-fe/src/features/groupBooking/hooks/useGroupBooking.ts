import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelGroupBooking,
  confirmGroupBookingPayment,
  createGroupBooking,
  getGroupBooking,
  quoteGroupBooking,
} from '../api/groupBooking.api';
import { bookingsQueryKey } from '@/features/booking/hooks/useBookings';
import type { GroupBookingPayload } from '../types/groupBooking.types';

// Root key for the group pages. RealtimeBridge invalidates it on booking:updated / payment:updated, so
// a payment confirmed by MoMo's IPN shows up without a reload.
export const groupBookingQueryKey = ['groupBooking'] as const;
export const groupBookingDetailQueryKey = (code: string) => [...groupBookingQueryKey, 'detail', code] as const;
const groupQuoteQueryKey = (payload: GroupBookingPayload | null) => [...groupBookingQueryKey, 'quote', payload] as const;

const PENDING_POLL_MS = 15_000;

/** Re-quoted whenever the selection changes; keeps showing the last quote while the next one loads. */
export function useGroupBookingQuote(payload: GroupBookingPayload | null) {
  return useQuery({
    queryKey: groupQuoteQueryKey(payload),
    queryFn: () => quoteGroupBooking(payload as GroupBookingPayload),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useCreateGroupBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: GroupBookingPayload; idempotencyKey: string }) =>
      createGroupBooking(payload, idempotencyKey),
    onSuccess: (data) => {
      queryClient.setQueryData(groupBookingDetailQueryKey(data.booking.code), data.booking);
    },
  });
}

export function useGroupBooking(code: string | undefined) {
  return useQuery({
    queryKey: groupBookingDetailQueryKey(code ?? ''),
    queryFn: () => getGroupBooking(code as string),
    enabled: Boolean(code),
    retry: false,
    // Realtime does the work; this only covers a dropped socket while the payment is outstanding.
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? PENDING_POLL_MS : false),
  });
}

export function useCancelGroupBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => cancelGroupBooking(code),
    onSuccess: (booking) => {
      queryClient.setQueryData(groupBookingDetailQueryKey(booking.code), booking);
      queryClient.invalidateQueries({ queryKey: bookingsQueryKey });
    },
  });
}

export function useConfirmGroupBookingPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, params }: { code: string; params: Record<string, string> }) =>
      confirmGroupBookingPayment(code, params),
    onSuccess: (data) => {
      queryClient.setQueryData(groupBookingDetailQueryKey(data.booking.code), data.booking);
      queryClient.invalidateQueries({ queryKey: groupBookingQueryKey });
    },
  });
}
