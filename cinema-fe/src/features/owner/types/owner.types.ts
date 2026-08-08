import type { DISCOUNT_TYPE } from '@/constants/discountType';

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
}

export interface VoucherFormValues {
  cinema_id: string;
  code: string;
  discount_type: (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];
  discount_value: string;
  min_order_value: string;
}

export interface EmployeeFormValues {
  cinema_id: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  position: string;
}

export interface SeatMapFormValues {
  rowsInput: string;
  seatsPerRow: string;
  vipRows: string;
  coupleRows: string;
}

export interface OwnerDashboardState {
  selectedCinemaId: string;
}

export interface OwnerCinemasState {
  showAddRoomModal: boolean;
  seatMapRoomId: number | null;
}

export interface OwnerCombosState {
  showAddModal: boolean;
}

export interface OwnerVouchersState {
  showAddModal: boolean;
}

export interface OwnerEmployeesState {
  selectedCinemaId: string;
  showAddModal: boolean;
}
