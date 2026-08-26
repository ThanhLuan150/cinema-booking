export interface BookedSeatTicket {
  id: number;
  seat_code: string;
  seat_type: number;
  status: number;
  held_by_me?: boolean;
  price: number | null;
}

export interface HoldSeatsResult {
  held: { id: number; seat_code: string; status: number }[];
  held_until: string;
}

export type PaymentStatus = 'confirming' | 'success' | 'failed';

export interface BookingState {
  movieId: string | null;
  movieDate: string | null;
  timeBegin: string | null;
  scheduleId: number | null;
  branchId: number | null;
  selectedDay: string;
  selectedTime: string;
  selectedSeatCodes: string[];
  selectedTickets: BookedSeatTicket[];
  heldUntilBySeat: Record<string, string>;
  selectedComboIds: number[];
  voucherCode: string;
  voucherResult: VoucherValidationResult | null;
  voucherError: string;
  promotionCode: string;
  promotionResult: PromotionValidationResult | null;
  promotionError: string;
  momoPayUrl: string;
  paymentStatus: PaymentStatus;
  paymentMessage: string;
}

export interface ScheduleDateOption {
  movie_date: string;
  times: string[];
}

export interface MomoPaymentPayload {
  ticketIds: number[];
  comboIds: number[];
  voucherCode: string | null;
  promotionCode: string | null;
  discountAmount: number;
  totalPrice: number;
}

export interface VoucherValidationPayload {
  code: string;
  cinema_id: number | null;
  order_value: number;
}

export interface VoucherValidationResult {
  discount_amount: number;
  [key: string]: unknown;
}

export interface PromotionValidationPayload {
  code: string;
  branch_id: number | null;
  movie_id: number | null;
  showtime_id: number | null;
  combo_ids: number[];
  order_value: number;
}

export interface PromotionValidationResult {
  discount_amount: number;
  [key: string]: unknown;
}

export interface InvoiceMovie {
  id: number;
  name: string;
  avatar: string;
  categories?: { id: number; name: string }[];
}

export interface InvoiceSchedule {
  movie_date: string;
  time_begin: string;
}

export interface InvoiceTicket {
  seat_code: string;
  seat_type: number;
}

export interface Invoice {
  id: number;
  code: string;
  status: number;
  total_price: number;
  discount_amount: number;
  movie?: InvoiceMovie;
  schedule?: InvoiceSchedule;
  ticket?: InvoiceTicket;
}

export interface MomoConfirmParams {
  resultCode?: string;
  message?: string;
  [key: string]: string | undefined;
}

export type BookingStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED';

export interface BookingTicket {
  id: number;
  seat_code: string;
  seat_type: number;
}

export interface Booking {
  id: number;
  code: string;
  account_id: number;
  schedule_id: number;
  branch_id: number;
  status: BookingStatus;
  tickets: BookingTicket[];
  combo_ids: number[];
  voucher_code: string | null;
  promotion_code: string | null;
  discount_amount: number;
  seat_total: number;
  combo_total: number;
  total_price: number;
  expires_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  needs_reschedule_response: boolean;
  movie?: InvoiceMovie | null;
  schedule?: InvoiceSchedule | null;
  branch?: { id: number; name: string } | null;
  account?: { id: number; email: string; name?: string } | null;
  createdAt: string;
}

export interface BookingListParams {
  page?: number;
  limit?: number;
  status?: BookingStatus;
}

export type TicketStatus = 'ISSUED' | 'USED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';

export interface TicketMovie {
  id: number;
  name: string;
  avatar: string;
}

export interface TicketSchedule {
  id: number;
  movie_date: string;
  time_begin: string;
  time_end: string;
}

export interface TicketRoom {
  id: number;
  name: string;
  type: string;
}

export interface TicketBranch {
  id: number;
  name: string;
  address: string;
  city: string;
}

export interface Ticket {
  ticket_id: number;
  booking_id: number | null;
  code: string;
  showtime_id: number | null;
  movie_id: number | null;
  branch_id: number | null;
  room_id: number | null;
  seat_id: number | null;
  seat_code: string | null;
  seat_type: number | null;
  status: TicketStatus;
  checked_in: boolean;
  qr_token: string | null;
  issued_at: string | null;
  total_price: number;
  movie: TicketMovie | null;
  schedule: TicketSchedule | null;
  room: TicketRoom | null;
  branch: TicketBranch | null;
}
