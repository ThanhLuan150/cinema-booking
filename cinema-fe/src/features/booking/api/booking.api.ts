import apiClient from 'services/apiClient';
import type { Combo, Room, Schedule } from '@/types/entities';
import type { PaginatedResponse } from '@/types/pagination';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import type {
  BookedSeatTicket,
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

export const getSchedule = (scheduleId: number | string) =>
  apiClient.get<Schedule>(`/schedule/${scheduleId}`).then((res) => res.data);

// Returns the MoMo payUrl to redirect to.
export const momoPayment = (payload: MomoPaymentPayload) =>
  apiClient.post<string>('/MomoPayment', payload).then((res) => res.data);

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
