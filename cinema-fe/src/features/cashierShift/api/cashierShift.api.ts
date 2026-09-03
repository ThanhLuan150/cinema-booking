import apiClient from 'services/apiClient';
import type { PaginatedResponse } from '@/types/pagination';
import type {
  CashierShift,
  CashierShiftDetailResponse,
  CashierShiftListParams,
  CloseCashierShiftPayload,
  CurrentCashierShiftResponse,
  OpenCashierShiftPayload,
} from '../types/cashierShift.types';

export const getCashierShifts = (params?: CashierShiftListParams) =>
  apiClient.get<PaginatedResponse<CashierShift>>('/cashier-shifts', { params }).then((res) => res.data);

export const getCurrentCashierShift = () =>
  apiClient.get<CurrentCashierShiftResponse>('/cashier-shifts/current').then((res) => res.data);

export const getCashierShiftById = (id: number | string) =>
  apiClient.get<CashierShift>(`/cashier-shifts/${id}`).then((res) => res.data);

export const getCashierShiftReconciliation = (id: number | string) =>
  apiClient.get<CashierShiftDetailResponse>(`/cashier-shifts/${id}/reconciliation`).then((res) => res.data);

export const openCashierShift = (payload: OpenCashierShiftPayload) =>
  apiClient.post<CashierShift>('/cashier-shifts/open', payload).then((res) => res.data);

export const closeCashierShift = (id: number | string, payload: CloseCashierShiftPayload) =>
  apiClient.post<CashierShift>(`/cashier-shifts/${id}/close`, payload).then((res) => res.data);
