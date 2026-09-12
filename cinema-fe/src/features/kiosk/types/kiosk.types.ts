export type KioskStep = 'KEY' | 'MOVIE' | 'SHOWTIME' | 'SEAT' | 'COMBO' | 'PROMO' | 'PAYMENT' | 'TICKET';

export interface KioskSession {
  kiosk: { id: number; kiosk_code: string; name: string; status: string; branch_id: number };
  branch: { id: number; name: string; address: string | null } | null;
}

export interface KioskMovie {
  id: number;
  name: string;
  avatar?: string;
  time?: number;
  describe?: string;
  [key: string]: unknown;
}

export interface KioskShowtime {
  id: number;
  movie_id: number;
  room_id: number;
  movie_date: string;
  time_begin: string;
  time_end: string;
  price: number;
  status: string;
}

export interface KioskSeat {
  id: number;
  seat_code: string;
  seat_type: number;
  status: number;
  held_by_me: boolean;
  price: number | null;
}

export interface KioskQuote {
  seatTotal: number;
  comboTotal: number;
  discountAmount: number;
  totalPrice: number;
  voucherCode: string | null;
  promotionCode: string | null;
}

export interface KioskCheckoutResult {
  code: string;
  bookingId: number;
  amount: number;
  expiresAt?: string;
  alreadyProcessed?: boolean;
}

export interface KioskConfirmResult {
  paid: boolean;
  code: string;
  bookingId?: number;
  reason?: string;
  alreadyProcessed?: boolean;
}

export interface KioskTicketView {
  ticket_id: number;
  seat_code: string;
  qr_token: string | null;
  movie?: { name: string } | null;
  schedule?: { movie_date: string; time_begin: string } | null;
  [key: string]: unknown;
}

export interface KioskOrderInput {
  ticketIds: number[];
  comboIds: number[];
  voucherCode: string | null;
  promotionCode: string | null;
}

export interface KioskCombo {
  id: number;
  name: string;
  description?: string;
  price: number;
  [key: string]: unknown;
}
