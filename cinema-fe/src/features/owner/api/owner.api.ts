import apiClient from 'services/apiClient';
import type {
  Cinema,
  Combo,
  Employee,
  Holiday,
  Inventory,
  InventoryTransaction,
  MaintenanceRequest,
  Position,
  PricingRule,
  Promotion,
  Room,
  Seat,
  Shift,
  ShiftAssignment,
  Voucher,
} from '@/types/entities';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  CinemaFormValues,
  CreateComboPayload,
  CreateInventoryPayload,
  EmployeeFormValues,
  GenerateSeatMapPayload,
  HolidayFormValues,
  LookedUpInvoice,
  OwnerDashboardStats,
  PricingRuleFormValues,
  VoucherFormValues,
} from '../types/owner.types';

export const getMyCinemas = (params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Cinema>>('/cinema/mine', { params }).then((res) => res.data);

export const updateCinema = (id: number | string, payload: Partial<CinemaFormValues>) =>
  apiClient.put(`/cinema/${id}`, payload);

export const getRoomsByCinema = (branchId: number | string | undefined, params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Room>>('/room', { params: { branchId, ...params } }).then((res) => res.data);

export const createRoom = (payload: { name: string; cinema_id: number; code: string; type: string; capacity: number }) =>
  apiClient.post('/room', payload);

export const updateRoom = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/room/${id}`, payload);

export const deleteRoom = (id: number | string) => apiClient.delete(`/room/${id}`);

export const getSeatsByRoom = (roomId: number | string) =>
  apiClient.get<Seat[]>(`/seat/room/${roomId}`).then((res) => res.data);

export const generateSeatMap = (roomId: number | string, payload: GenerateSeatMapPayload) =>
  apiClient.post(`/seat/room/${roomId}/generate`, payload);

export const updateSeat = (id: number | string, payload: { status: 'ACTIVE' | 'DISABLED' }) =>
  apiClient.put(`/seat/${id}`, payload);

export const getOwnerCombos = (branchId?: number | string, params?: PaginationParams) =>
  apiClient.get<PaginatedResponse<Combo>>('/combo', { params: { branchId, ...params } }).then((res) => res.data);

export const createCombo = (payload: CreateComboPayload) => apiClient.post('/combo', payload);

export const updateCombo = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/combo/${id}`, payload);

export const deleteCombo = (id: number | string) => apiClient.delete(`/combo/${id}`);

export const getOwnerInventory = (branchId?: number | string, params?: PaginationParams & { status?: string }) =>
  apiClient.get<PaginatedResponse<Inventory>>('/inventory', { params: { branchId, ...params } }).then((res) => res.data);

export const getInventoryAlerts = (branchId?: number | string) =>
  apiClient.get<Inventory[]>('/inventory/alerts', { params: { branchId } }).then((res) => res.data);

export const getInventoryHistory = (id: number | string, params?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<InventoryTransaction>>(`/inventory/${id}/history`, { params })
    .then((res) => res.data);

export const createInventory = (payload: CreateInventoryPayload) => apiClient.post('/inventory', payload);

export const updateInventory = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/inventory/${id}`, payload);

export const deleteInventory = (id: number | string) => apiClient.delete(`/inventory/${id}`);

export const receiveInventory = (id: number | string, payload: { quantity: number; reason?: string }) =>
  apiClient.post(`/inventory/${id}/receive`, payload);

export const adjustInventory = (id: number | string, payload: { quantity: number; reason?: string }) =>
  apiClient.post(`/inventory/${id}/adjust`, payload);

export const deductInventory = (id: number | string, payload: { quantity: number; reason?: string }) =>
  apiClient.post(`/inventory/${id}/deduct`, payload);

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

export const getOwnerPromotions = (branchId?: number | string, params?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<Promotion>>('/promotion', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface PromotionPayload {
  code: string;
  name: string;
  description: string;
  discount_type: Promotion['discount_type'];
  discount_value: number;
  minimum_order_value: number;
  maximum_discount: number | null;
  start_at: string;
  end_at: string;
  usage_limit: number | null;
  per_customer_limit: number | null;
  branch_ids: number[];
  movie_ids: number[];
  combo_ids: number[];
}

export const createPromotion = (payload: PromotionPayload) => apiClient.post('/promotion', payload);

export const updatePromotion = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/promotion/${id}`, payload);

export const deletePromotion = (id: number | string) => apiClient.delete(`/promotion/${id}`);

export const getOwnerPricingRules = (branchId?: number | string, params?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<PricingRule>>('/pricingRule', { params: { branchId, ...params } })
    .then((res) => res.data);

export type PricingRulePayload = Pick<PricingRuleFormValues, 'name'> & {
  price: number;
  priority: number;
  branch_id: number | null;
  room_type: string | null;
  seat_type: number | null;
  category_id: number | null;
  day_type: string | null;
  time_start: string | null;
  time_end: string | null;
  membership_level: string | null;
  effective_from: string | null;
  effective_to: string | null;
};

export const createPricingRule = (payload: PricingRulePayload) => apiClient.post('/pricingRule', payload);

export const updatePricingRule = (id: number | string, payload: Record<string, unknown>) =>
  apiClient.put(`/pricingRule/${id}`, payload);

export const deletePricingRule = (id: number | string) => apiClient.delete(`/pricingRule/${id}`);

export const getOwnerHolidays = (branchId?: number | string, params?: PaginationParams) =>
  apiClient
    .get<PaginatedResponse<Holiday>>('/pricingHoliday', { params: { branchId, ...params } })
    .then((res) => res.data);

export const createHoliday = (payload: Omit<HolidayFormValues, 'branch_id'> & { branch_id: number | null }) =>
  apiClient.post('/pricingHoliday', payload);

export const deleteHoliday = (id: number | string) => apiClient.delete(`/pricingHoliday/${id}`);

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

export const getMaintenanceRequests = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: string; resourceType?: string },
) =>
  apiClient
    .get<PaginatedResponse<MaintenanceRequest>>('/maintenance', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface CreateMaintenanceRequestPayload {
  branch_id: number;
  resource_type: MaintenanceRequest['resource_type'];
  room_id?: number;
  seat_id?: number;
  resource_name?: string;
  title: string;
  description?: string;
}

export const createMaintenanceRequest = (payload: CreateMaintenanceRequestPayload) =>
  apiClient.post('/maintenance', payload);

export const assignMaintenanceRequest = (id: number | string, payload: { employee_id: number }) =>
  apiClient.post(`/maintenance/${id}/assign`, payload);

export const startMaintenanceRequest = (id: number | string) => apiClient.post(`/maintenance/${id}/start`);

export const resolveMaintenanceRequest = (id: number | string, payload: { resolution_note?: string }) =>
  apiClient.post(`/maintenance/${id}/resolve`, payload);

export const closeMaintenanceRequest = (id: number | string) => apiClient.post(`/maintenance/${id}/close`);

export const deleteMaintenanceRequest = (id: number | string) => apiClient.delete(`/maintenance/${id}`);
