import apiClient from 'services/apiClient';
import type {
  CreateInSeatOrderPayload,
  CreateInSeatOrderResponse,
  InSeatConfirmResponse,
  InSeatOrder,
  InSeatSession,
  SeatQrSheet,
} from '../types/inSeat.types';

// The scanned seat QR is the only thing that says which seat an order is for; the server re-checks it
// (and the caller's ticket for that seat and showtime) on every call.
export const getInSeatSession = (qr: string) =>
  apiClient.post<InSeatSession>('/in-seat/session', { qr }).then((res) => res.data);

// Only { qr, items: [{ combo_id, quantity }] } travels — prices come from the server alone.
export const createInSeatOrder = (payload: CreateInSeatOrderPayload, idempotencyKey: string) =>
  apiClient
    .post<CreateInSeatOrderResponse>(
      '/in-seat/orders',
      {
        qr: payload.qr,
        items: payload.items.map(({ combo_id, quantity }) => ({ combo_id, quantity })),
      },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
    .then((res) => res.data);

// The browser is back from MoMo: hand the (signed) result to the server, which applies it once.
export const confirmInSeatMomoPayment = (code: string, params: Record<string, string>) =>
  apiClient
    .post<InSeatConfirmResponse>(`/in-seat/orders/${encodeURIComponent(code)}/momo-confirm`, params)
    .then((res) => res.data);

export const getInSeatOrder = (code: string) =>
  apiClient.get<InSeatOrder>(`/in-seat/orders/${encodeURIComponent(code)}`).then((res) => res.data);

export const getMyInSeatOrders = (scheduleId?: number) =>
  apiClient
    .get<InSeatOrder[]>('/in-seat/orders', { params: { scheduleId } })
    .then((res) => res.data);

export const getSeatQrSheet = (scheduleId: number) =>
  apiClient.get<SeatQrSheet>(`/in-seat/showtimes/${scheduleId}/seat-qr`).then((res) => res.data);
