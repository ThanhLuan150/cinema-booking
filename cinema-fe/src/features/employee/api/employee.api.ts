import apiClient from 'services/apiClient';
import type { Schedule } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { BookedSeatTicket } from '@/features/booking/types/booking.types';
import type { CounterSalePayload, LookedUpInvoice } from '../types/employee.types';

// The backend auto-scopes /schedule to the caller's own cinema for an employee account.
export const getMySchedules = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Schedule>>('/schedule', { params }).then((res) => res.data);

export const getScheduleSeats = (scheduleId: number | string) =>
  apiClient.get<BookedSeatTicket[]>(`/bookseat/${scheduleId}`).then((res) => res.data);

export const findAccountByEmail = (email: string) =>
  apiClient.get<{ id: number; email: string }>(`/account/${email}`).then((res) => res.data);

export const createCounterSale = (payload: CounterSalePayload) =>
  apiClient.post<{ id: number }>('/invoice/counter-sale', payload).then((res) => res.data);

export const lookupInvoiceByCode = (code: string) =>
  apiClient.get<LookedUpInvoice>(`/invoice/lookup/${code}`).then((res) => res.data);

export const checkInInvoice = (invoiceId: number | string) => apiClient.post(`/invoice/${invoiceId}/checkin`);
