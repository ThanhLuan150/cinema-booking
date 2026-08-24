import apiClient from 'services/apiClient';
import type { Combo, Room, Schedule } from '@/types/entities';
import type { PaginatedResponse } from '@/types/pagination';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import type { Seat } from '@/types/entities';
import type {
  BookedSeatTicket,
  Booking,
  BookingListParams,
  HoldSeatsResult,
  Invoice,
  MomoConfirmParams,
  MomoPaymentPayload,
  ScheduleDateOption,
  VoucherValidationPayload,
  VoucherValidationResult,
} from '../types/booking.types';

export const getScheduleId = (payload: { movie_id: string; movie_date: string; time_begin: string }) =>
  apiClient.post<{ id: number }>('/scheduleId/', payload).then((res) => res.data);

export const getBookedSeats = (scheduleId: number | string) =>
  apiClient.get<BookedSeatTicket[]>(`/bookseat/${scheduleId}`).then((res) => res.data);

export const getRoomSeats = (roomId: number | string) =>
  apiClient.get<Seat[]>(`/seat/room/${roomId}`).then((res) => res.data);

export const holdSeats = (scheduleId: number | string, seatCodes: string[]) =>
  apiClient.post<HoldSeatsResult>(`/bookseat/${scheduleId}/hold`, { seatCodes }).then((res) => res.data);

export const releaseSeats = (scheduleId: number | string, seatCodes: string[]) =>
  apiClient.post(`/bookseat/${scheduleId}/release`, { seatCodes }).then((res) => res.data);

export const getSchedule = (scheduleId: number | string) =>
  apiClient.get<Schedule>(`/schedule/${scheduleId}`).then((res) => res.data);

export const momoPayment = (payload: MomoPaymentPayload, idempotencyKey?: string) =>
  apiClient
    .post<string>('/MomoPayment', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    })
    .then((res) => res.data);

// Called from PaymentResultPage after MoMo redirects back, with the same query params MoMo sent.
export const confirmMomoPayment = (payload: MomoConfirmParams) =>
  apiClient.post('/MomoPayment/confirm', payload).then((res) => res.data);

export const getBookTicketSchedule = (id: string | number) =>
  apiClient.get<ScheduleDateOption[]>(`/bookticket/${id}`).then((res) => res.data);

export const getMyInvoices = () => apiClient.get<Invoice[]>('/my-invoices').then((res) => res.data);

export const cancelInvoice = (invoiceId: number | string) => apiClient.post(`/invoice/${invoiceId}/cancel`);

export const validateVoucher = (payload: VoucherValidationPayload) =>
  apiClient.post<VoucherValidationResult>('/voucher/validate', payload).then((res) => res.data);

export const getCombos = (branchId?: number | null) =>
  apiClient
    .get<PaginatedResponse<Combo>>('/combo', { params: { branchId, limit: FULL_LIST_FETCH_LIMIT } })
    .then((res) => res.data.data);

export const getRoomsList = () =>
  apiClient
    .get<PaginatedResponse<Room>>('/room', { params: { limit: FULL_LIST_FETCH_LIMIT } })
    .then((res) => res.data.data);

export const getBookings = (params?: BookingListParams) =>
  apiClient.get<PaginatedResponse<Booking>>('/bookings', { params }).then((res) => res.data);

export const getBookingById = (id: number | string) =>
  apiClient.get<Booking>(`/bookings/${id}`).then((res) => res.data);

export const cancelBooking = (id: number | string) => apiClient.post(`/bookings/${id}/cancel`);
