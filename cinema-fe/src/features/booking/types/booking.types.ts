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
