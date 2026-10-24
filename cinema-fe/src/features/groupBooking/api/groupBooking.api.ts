import apiClient from 'services/apiClient';
import type {
  GroupBooking,
  GroupBookingPayload,
  GroupBookingQuote,
  GroupCheckoutResponse,
  GroupConfirmResponse,
} from '../types/groupBooking.types';

// Read-only: what checkout would charge for this selection right now.
export const quoteGroupBooking = (payload: GroupBookingPayload) =>
  apiClient.post<GroupBookingQuote>('/group-bookings/quote', payload).then((res) => res.data);

// The Idempotency-Key makes a double-click or a network retry return the same booking and pay link.
export const createGroupBooking = (payload: GroupBookingPayload, idempotencyKey: string) =>
  apiClient
    .post<GroupCheckoutResponse>('/group-bookings', payload, { headers: { 'Idempotency-Key': idempotencyKey } })
    .then((res) => res.data);

export const getGroupBooking = (code: string) =>
  apiClient.get<GroupBooking>(`/group-bookings/${encodeURIComponent(code)}`).then((res) => res.data);

export const cancelGroupBooking = (code: string) =>
  apiClient.post<GroupBooking>(`/group-bookings/${encodeURIComponent(code)}/cancel`, {}).then((res) => res.data);

// The browser is back from MoMo: the signed result goes to the server (success or failure alike — a
// failure is what releases the group's seats straight away).
export const confirmGroupBookingPayment = (code: string, params: Record<string, string>) =>
  apiClient
    .post<GroupConfirmResponse>(`/group-bookings/${encodeURIComponent(code)}/momo-confirm`, params)
    .then((res) => res.data);
