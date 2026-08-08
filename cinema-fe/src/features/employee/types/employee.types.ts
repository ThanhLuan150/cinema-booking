export interface CounterSalePayload {
  ticketIds: number[];
  comboIds: number[];
  voucherCode: string | null;
  discountAmount: number;
  totalPrice: number;
  accountId: number;
  cinema_id: number;
}

export interface LookedUpInvoice {
  id: number;
  code: string;
  status: number;
  checked_in: boolean;
  total_price: number;
  movie?: { name: string };
  cinema?: { name: string };
  schedule?: { movie_date: string; time_begin: string };
  ticket?: { seat_code: string; seat_type: number; status: number };
}

export interface EmployeeCounterSaleState {
  selectedScheduleId: string;
  selectedTicketIds: number[];
}
