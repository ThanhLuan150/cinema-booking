import kioskClient from './kioskClient';
import type {
  KioskSession,
  KioskMovie,
  KioskShowtime,
  KioskSeat,
  KioskQuote,
  KioskCheckoutResult,
  KioskConfirmResult,
  KioskTicketView,
  KioskOrderInput,
  KioskCombo,
} from '../types/kiosk.types';

export const getKioskSession = () => kioskClient.get<KioskSession>('/kiosks/session').then((r) => r.data);

export const getKioskMovies = () => kioskClient.get<KioskMovie[]>('/kiosks/movies').then((r) => r.data);

export const getKioskCombos = () => kioskClient.get<KioskCombo[]>('/kiosks/combos').then((r) => r.data);

export const getKioskShowtimes = (movieId: number) =>
  kioskClient.get<KioskShowtime[]>(`/kiosks/movies/${movieId}/showtimes`).then((r) => r.data);

export const getKioskSeats = (scheduleId: number) =>
  kioskClient.get<KioskSeat[]>(`/kiosks/showtimes/${scheduleId}/seats`).then((r) => r.data);

export const holdKioskSeats = (scheduleId: number, seatCodes: string[]) =>
  kioskClient.post(`/kiosks/showtimes/${scheduleId}/hold`, { seatCodes }).then((r) => r.data);

export const releaseKioskSeats = (scheduleId: number, seatCodes: string[]) =>
  kioskClient.post(`/kiosks/showtimes/${scheduleId}/release`, { seatCodes }).then((r) => r.data);

export const quoteKioskOrder = (input: KioskOrderInput & { scheduleId: number }) =>
  kioskClient.post<KioskQuote>('/kiosks/quote', input).then((r) => r.data);

export const checkoutKioskOrder = (
  input: KioskOrderInput & { scheduleId: number },
  idempotencyKey: string,
) =>
  kioskClient
    .post<KioskCheckoutResult>('/kiosks/checkout', input, { headers: { 'Idempotency-Key': idempotencyKey } })
    .then((r) => r.data);

export const confirmKioskPayment = (
  code: string,
  outcome: 'SUCCESS' | 'FAILURE',
  method?: 'CARD' | 'QR_PAYMENT',
) =>
  kioskClient
    .post<KioskConfirmResult>(`/kiosks/checkout/${code}/confirm`, { outcome, method })
    .then((r) => r.data);

export const getKioskBookingTickets = (code: string) =>
  kioskClient
    .get<{ booking: { id: number; code: string; total_price: number }; tickets: KioskTicketView[] }>(
      `/kiosks/bookings/${code}/tickets`,
    )
    .then((r) => r.data);
