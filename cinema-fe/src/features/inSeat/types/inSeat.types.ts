export type InSeatOrderStatus =
  'PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export type InSeatOrderingReason = 'IN_SEAT_ORDERING_NOT_OPEN' | 'IN_SEAT_ORDERING_CLOSED';

export interface InSeatMenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string | null;
  type: 'FOOD' | 'BEVERAGE' | 'COMBO';
}

export interface InSeatOrderItem {
  combo_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface InSeatOrderSeat {
  code: string;
  room: string | null;
  showtime: { id: number; date: string | null; time: string | null };
}

/** One in-seat order as its customer sees it (prices included — it is their own bill). */
export interface InSeatOrder {
  id: number;
  code: string;
  status: InSeatOrderStatus;
  items: InSeatOrderItem[];
  total_price: number;
  seat: InSeatOrderSeat | null;
  booking_id: number | null;
  payment: { status: string; method: string; amount: number } | null;
  /** Only while the order can still be paid for; null otherwise. */
  pay_url: string | null;
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  prepared_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface InSeatOrdering {
  open: boolean;
  reason: InSeatOrderingReason | null;
  opens_at: string | null;
  closes_at: string | null;
}

/** What the server confirmed about a scanned seat QR — never the token itself. */
export interface InSeatSession {
  branch: { id: number; name: string };
  room: { id: number; name: string };
  showtime: { id: number; date: string; time_begin: string; time_end: string };
  movie: { id: number; name: string; avatar: string | null } | null;
  seat: { code: string };
  ticket: { id: number; status: string };
  booking: { id: number; code: string };
  ordering: InSeatOrdering;
  menu: InSeatMenuItem[];
  orders: InSeatOrder[];
}

export interface InSeatOrderLine {
  combo_id: number;
  quantity: number;
}

export interface CreateInSeatOrderPayload {
  qr: string;
  items: InSeatOrderLine[];
}

export interface CreateInSeatOrderResponse {
  order: InSeatOrder;
  pay_url: string | null;
}

export interface InSeatConfirmResponse {
  success: boolean;
  already_processed: boolean;
  refund_pending: boolean;
  order: InSeatOrder;
}

export interface SeatQrSheetSeat {
  seat_code: string;
  seat_type: number;
  token: string;
}

export interface SeatQrSheet {
  showtime: { id: number; date: string; time_begin: string; time_end: string; status: string };
  branch: { id: number; name: string | null };
  room: { id: number; name: string };
  movie: { id: number; name: string } | null;
  seats: SeatQrSheetSeat[];
}
