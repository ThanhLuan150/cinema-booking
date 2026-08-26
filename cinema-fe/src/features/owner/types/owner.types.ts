import type { DISCOUNT_TYPE } from '@/constants/discountType';
import type { PROMOTION_DISCOUNT_TYPE } from '@/constants/promotionDiscountType';

export interface RevenueByDay {
  date: string;
  total: number;
}

export interface OwnerDashboardStats {
  revenue: number;
  totalTicketsSold: number;
  occupancyRate: number;
  scheduleCount: number;
  revenueByDay: RevenueByDay[];
}

export interface GenerateSeatMapPayload {
  rows: string[];
  seatsPerRow: number;
  vipRows: string[];
  coupleRows: string[];
}

export interface LookedUpInvoice {
  code: string;
  status: number;
  total_price: number;
  movie?: { name: string };
  cinema?: { name: string };
  schedule?: { movie_date: string; time_begin: string };
  ticket?: { seat_code: string; seat_type: number };
}

export interface CinemaFormValues {
  name: string;
  address: string;
  city: string;
}

export interface ComboFormValues {
  cinema_id: string;
  name: string;
  description: string;
  price: string;
  type: 'FOOD' | 'BEVERAGE' | 'COMBO';
  // combo item_id -> quantity; only meaningful (and only sent) when type === 'COMBO'
  items: Record<number, number>;
}

// Wire payload for POST /combo — `items` here is already normalized to the array shape the
// backend expects, unlike ComboFormValues.items (a form-friendly item_id -> quantity map).
export interface CreateComboPayload {
  cinema_id: number;
  name: string;
  description: string;
  price: number;
  type: 'FOOD' | 'BEVERAGE' | 'COMBO';
  items: { item_id: number; quantity: number }[];
}

export interface VoucherFormValues {
  cinema_id: string;
  code: string;
  discount_type: (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];
  discount_value: string;
  min_order_value: string;
}

// branch_id === 'ALL' means a system-wide (branch_id: null) rule — admin only. Every other
// match field uses '' as its "any / wildcard" value, mapped to null on submit.
export interface PricingRuleFormValues {
  name: string;
  price: string;
  priority: string;
  branch_id: string;
  room_type: string;
  seat_type: string;
  category_id: string;
  day_type: string;
  time_start: string;
  time_end: string;
  membership_level: string;
  effective_from: string;
  effective_to: string;
}

export interface HolidayFormValues {
  date: string;
  name: string;
  branch_id: string;
}

export interface EmployeeFormValues {
  cinema_id: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  position_id: string;
}

export interface SeatMapFormValues {
  rowsInput: string;
  seatsPerRow: string;
  vipRows: string;
  coupleRows: string;
}

export interface RoomFormValues {
  name: string;
  code: string;
  type: string;
  capacity: string;
  status?: string;
}

export interface OwnerDashboardState {
  selectedbranchId: string;
}

export interface OwnerCinemasState {
  showAddRoomModal: boolean;
  seatMapRoomId: number | null;
  editingRoomId: number | null;
}

export interface OwnerCombosState {
  showAddModal: boolean;
}

export interface InventoryFormValues {
  cinema_id: string;
  item: string;
  combo_id: string; // '' means this item is not linked to a Combo (no auto-deduction on sale)
  quantity: string;
  minimum_quantity: string;
  unit: string;
}

// Wire payload for POST /inventory — numeric fields already coerced from InventoryFormValues.
export interface CreateInventoryPayload {
  branch_id: number;
  item: string;
  combo_id: number | null;
  quantity: number;
  minimum_quantity: number;
  unit: string;
}

export type StockActionMode = 'receive' | 'adjust' | 'deduct';

export interface StockActionFormValues {
  quantity: string;
  reason: string;
}

export interface OwnerInventoryState {
  showAddModal: boolean;
  stockAction: { id: number; mode: StockActionMode } | null;
  historyItemId: number | null;
}

export interface OwnerVouchersState {
  showAddModal: boolean;
}

// branch_id === 'ALL' means a system-wide promotion (branch_ids: []) — admin only, same
// convention as PricingRuleFormValues.branch_id. movie_id/combo_id === '' means "any" (no
// restriction on that dimension); Showtime targeting has no picker yet and is left empty.
export interface PromotionFormValues {
  code: string;
  name: string;
  description: string;
  discount_type: (typeof PROMOTION_DISCOUNT_TYPE)[keyof typeof PROMOTION_DISCOUNT_TYPE];
  discount_value: string;
  minimum_order_value: string;
  maximum_discount: string;
  start_at: string;
  end_at: string;
  usage_limit: string;
  per_customer_limit: string;
  branch_id: string;
  movie_id: string;
  combo_id: string;
}

export interface OwnerPromotionsState {
  showAddModal: boolean;
  editingPromotionId: number | null;
}

export interface OwnerPricingRulesState {
  showAddModal: boolean;
  editingRuleId: number | null;
}

export interface OwnerHolidaysState {
  showAddModal: boolean;
}

export interface OwnerEmployeesState {
  selectedbranchId: string;
  showAddModal: boolean;
}

export interface ShiftFormValues {
  branch_id: string;
  name: string;
  start_time: string;
  end_time: string;
}

export interface ShiftAssignmentFormValues {
  employee_id: string;
  shift_id: string;
  date: string;
}

export interface OwnerShiftsState {
  selectedbranchId: string;
  showAddModal: boolean;
  editingShiftId: number | null;
  showAssignModal: boolean;
}
