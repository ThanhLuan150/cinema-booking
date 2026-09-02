import apiClient from 'services/apiClient';
import type { BoxOfficeBookingTickets, BoxOfficeSellPayload, BoxOfficeSellResult } from '../types/boxOffice.types';

export const sellAtBoxOffice = (payload: BoxOfficeSellPayload, idempotencyKey: string) =>
  apiClient
    .post<BoxOfficeSellResult>('/box-office/sell', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .then((res) => res.data);

export const getBoxOfficeBookingTickets = (bookingId: number | string) =>
  apiClient.get<BoxOfficeBookingTickets>(`/box-office/bookings/${bookingId}/tickets`).then((res) => res.data);
