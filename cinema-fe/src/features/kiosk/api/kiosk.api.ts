import kioskClient from './kioskClient';

export interface KioskSession {
  kiosk: { id: number; kiosk_code: string; name: string; status: string; branch_id: number };
  branch: { id: number; name: string; address: string | null } | null;
}

export interface KioskMovie {
  id: number;
  name: string;
  avatar?: string;
  time?: number;
  describe?: string;
  [key: string]: unknown;
}

export interface KioskShowtime {
  id: number;
  movie_id: number;
  room_id: number;
  movie_date: string;
  time_begin: string;
  time_end: string;
  price: number;
  status: string;
}

export interface KioskSeat {
  id: number;
  seat_code: string;
  seat_type: number;
  status: number;
  held_by_me: boolean;
  price: number | null;
}

export interface KioskQuote {
  seatTotal: number;
  comboTotal: number;
  discountAmount: number;
  totalPrice: number;
  voucherCode: string | null;
  promotionCode: string | null;
}

export interface KioskCheckoutResult {
  code: string;
  bookingId: number;
  amount: number;
  expiresAt?: string;
  alreadyProcessed?: boolean;
}

export interface KioskConfirmResult {
  paid: boolean;
  code: string;
  bookingId?: number;
  reason?: string;
  alreadyProcessed?: boolean;
}

export interface KioskTicketView {
  ticket_id: number;
  seat_code: string;
  qr_token: string | null;
  movie?: { name: string } | null;
  schedule?: { movie_date: string; time_begin: string } | null;
  [key: string]: unknown;
}

export interface KioskOrderInput {
  ticketIds: number[];
  comboIds: number[];
  voucherCode: string | null;
  promotionCode: string | null;
}

export const getKioskSession = () => kioskClient.get<KioskSession>('/kiosks/session').then((r) => r.data);

export const getKioskMovies = () => kioskClient.get<KioskMovie[]>('/kiosks/movies').then((r) => r.data);

export interface KioskCombo {
  id: number;
  name: string;
  description?: string;
  price: number;
  [key: string]: unknown;
}

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
