import type { Booking, Ticket } from '@/features/booking/types/booking.types';

export type BoxOfficePaymentMethod = 'CASH' | 'CARD' | 'QR_PAYMENT';

export interface BoxOfficeSellPayload {
  scheduleId: number | string;
  ticketIds: number[];
  comboIds: number[];
  voucherCode: string | null;
  promotionCode: string | null;
  accountId: number;
  method: BoxOfficePaymentMethod;
  cinema_id: number;
}

export interface BoxOfficeSellResult {
  bookingId: number;
  code: string;
  totalPrice: number;
  alreadyProcessed: boolean;
}

export interface BoxOfficeBookingTickets {
  booking: Booking;
  tickets: Ticket[];
}
