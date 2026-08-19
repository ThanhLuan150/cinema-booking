import apiClient from 'services/apiClient';
import type { Cinema, Combo, Employee, Position, Room, Seat, Shift, ShiftAssignment, Voucher } from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  CinemaFormValues,
  ComboFormValues,
  EmployeeFormValues,
  GenerateSeatMapPayload,
  LookedUpInvoice,
  OwnerDashboardStats,
  VoucherFormValues,
} from '../types/owner.types';

export const getMyCinemas = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Cinema>>('/cinema/mine', { params }).then((res) => res.data);

export const updateCinema = (id: number | string, payload: Partial<CinemaFormValues>) =>
  apiClient.put(`/cinema/${id}`, payload);

export const getRoomsByCinema = (branchId: number | string | undefined, params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Room>>('/room', { params: { branchId, ...params } }).then((res) => res.data);

export const createRoom = (payload: { name: string; cinema_id: number }) => apiClient.post('/room', payload);

export const updateRoom = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/room/${id}`, payload);

export const deleteRoom = (id: number | string) => apiClient.delete(`/room/${id}`);

export const getSeatsByRoom = (roomId: number | string) =>
  apiClient.get<Seat[]>(`/seat/room/${roomId}`).then((res) => res.data);

export const generateSeatMap = (roomId: number | string, payload: GenerateSeatMapPayload) =>
  apiClient.post(`/seat/room/${roomId}/generate`, payload);

export const updateSeat = (id: number | string, payload: { is_locked: boolean }) =>
  apiClient.put(`/seat/${id}`, payload);

export const getOwnerCombos = (branchId?: number | string, params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Combo>>('/combo', { params: { branchId, ...params } }).then((res) => res.data);

export const createCombo = (payload: Omit<ComboFormValues, 'price'> & { price: number }) =>
  apiClient.post('/combo', payload);

export const updateCombo = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/combo/${id}`, payload);

export const deleteCombo = (id: number | string) => apiClient.delete(`/combo/${id}`);

export const getOwnerVouchers = (branchId?: number | string, params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Voucher>>('/voucher', { params: { branchId, ...params } }).then((res) => res.data);

export const createVoucher = (
  payload: Omit<VoucherFormValues, 'discount_value' | 'min_order_value'> & {
    discount_value: number;
    min_order_value: number;
  },
) => apiClient.post('/voucher', payload);

export const updateVoucher = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/voucher/${id}`, payload);

export const deleteVoucher = (id: number | string) => apiClient.delete(`/voucher/${id}`);

export const getOwnerDashboard = (branchId?: number | string) =>
  apiClient.get<OwnerDashboardStats>('/owner/dashboard', { params: { branchId } }).then((res) => res.data);

export const lookupInvoiceByCode = (code: string) =>
  apiClient.get<LookedUpInvoice>(`/invoice/lookup/${code}`).then((res) => res.data);

// branchId omitted (Super Admin only, backend enforces this) lists employees across every branch.
export const getMyEmployees = (branchId: number | string | undefined, params?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<Employee>>('/employee', { params: { branchId, ...params } })
    .then((res) => res.data);

export const createEmployee = (
  payload: Omit<EmployeeFormValues, 'cinema_id' | 'position_id'> & { cinema_id: number; position_id: number },
) => apiClient.post('/employee', payload);

export const updateEmployee = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/employee/${id}`, payload);

export const deactivateEmployee = (id: number | string) => apiClient.delete(`/employee/${id}`);

export const resetEmployeePassword = (id: number | string) => apiClient.post(`/employee/${id}/reset-password`);

export const getPositions = () => apiClient.get<Position[]>('/position').then((res) => res.data);

export const getShifts = (branchId: number | string | undefined, params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Shift>>('/shift', { params: { branchId, ...params } }).then((res) => res.data);

export const createShift = (payload: { branch_id: number; name: string; start_time: string; end_time: string }) =>
  apiClient.post('/shift', payload);

export const updateShift = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/shift/${id}`, payload);

export const deleteShift = (id: number | string) => apiClient.delete(`/shift/${id}`);

export const getShiftAssignments = (
  branchId: number | string | undefined,
  params?: PaginationParams & { employeeId?: number | string; date?: string; status?: string },
) =>
  apiClient
    .get<PaginatedResponse<ShiftAssignment>>('/shiftAssignment', { params: { branchId, ...params } })
    .then((res) => res.data);

export const createShiftAssignment = (payload: {
  employee_id: number;
  shift_id: number;
  date: string;
  start_at?: string;
  end_at?: string;
}) => apiClient.post('/shiftAssignment', payload);

export const updateShiftAssignment = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/shiftAssignment/${id}`, payload);

export const deleteShiftAssignment = (id: number | string) => apiClient.delete(`/shiftAssignment/${id}`);
