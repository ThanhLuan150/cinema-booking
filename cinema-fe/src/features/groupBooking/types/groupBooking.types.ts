import type { BookingStatus } from '@/features/booking/types/booking.types';

export type OrganizerType = 'CUSTOMER' | 'COMPANY';
export type GroupDiscountSource = 'GROUP_PROMOTION' | 'PROMOTION_CODE' | 'VOUCHER';

export interface GroupOrganizer {
  organizer_type: OrganizerType;
  group_name: string;
  company_name: string;
  tax_code: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  note: string;
}

export interface GroupComboLine {
  combo_id: number;
  quantity: number;
}

/** POST /group-bookings and /group-bookings/quote. Never carries a price: the server computes every amount. */
export interface GroupBookingPayload {
  schedule_id: number;
  ticket_ids: number[];
  combos: GroupComboLine[];
  organizer: GroupOrganizer;
  promotion_code?: string;
}

export interface GroupDiscount {
  source: GroupDiscountSource;
  code: string;
  name: string;
  amount: number;
  min_tickets: number | null;
}

export interface GroupQuoteSeat {
  ticket_id: number;
  seat_code: string;
  seat_type: number;
  price: number;
}

export interface GroupQuoteCombo {
  combo_id: number;
  name: string;
  type: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface GroupStockShortage {
  combo_id: number;
  item: string;
  requested: number;
  available: number;
}

export interface GroupBookingQuote {
  schedule_id: number;
  seat_count: number;
  seats: GroupQuoteSeat[];
  combos: GroupQuoteCombo[];
  seat_total: number;
  combo_total: number;
  order_value: number;
  discount: GroupDiscount | null;
  total_price: number;
  unavailable_seat_codes: string[];
  stock_shortages: GroupStockShortage[];
  limits: { min_seats: number; max_seats: number };
}

export interface GroupBookingCombo {
  combo_id: number;
  name: string | null;
  unit_price: number | null;
  quantity: number;
  line_total: number | null;
}

export interface GroupBooking {
  id: number;
  code: string;
  booking_type: 'GROUP';
  status: BookingStatus;
  account_id: number;
  branch_id: number;
  schedule_id: number;
  group: (GroupOrganizer & { auto_discount: boolean }) | null;
  seats: { ticket_id: number; seat_code: string | null; seat_type: number | null }[];
  combos: GroupBookingCombo[];
  seat_total: number;
  combo_total: number;
  discount_amount: number;
  promotion_code: string | null;
  voucher_code: string | null;
  total_price: number;
  expires_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  createdAt: string;
  payment: { status: string; method: string; amount: number; pay_url: string | null } | null;
  tickets: { ticket_id: number; seat_code: string | null; status: string }[];
  schedule: { id: number; movie_date: string; time_begin: string; time_end: string } | null;
  movie: { id: number; name: string; avatar: string | null } | null;
  room: { id: number; name: string } | null;
  branch: { id: number; name: string } | null;
}

export interface GroupCheckoutResponse {
  booking: GroupBooking;
  pay_url: string | null;
  replayed: boolean;
}

export interface GroupConfirmResponse {
  success: boolean;
  already_processed: boolean;
  refund_pending: boolean;
  reason: 'SEATS_LOST' | 'BOOKING_NOT_PAYABLE' | null;
  booking: GroupBooking;
}
