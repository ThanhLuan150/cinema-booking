export type WaitlistStatus = 'WAITING' | 'NOTIFIED' | 'BOOKED' | 'EXPIRED' | 'CANCELLED';
export type WaitlistCloseReason = 'CUSTOMER_CANCELLED' | 'OFFER_EXPIRED' | 'SHOWTIME_STARTED' | 'SHOWTIME_CANCELLED';

/** The caller's own place in a showtime's waitlist. */
export interface WaitlistEntry {
  id: number;
  schedule_id: number;
  seat_count: number;
  status: WaitlistStatus;
  /** 1-based place in the queue while WAITING, otherwise null. */
  position: number | null;
  joined_at: string;
  notified_at: string | null;
  /** While NOTIFIED: the reserved seats are the customer's until this moment. */
  expires_at: string | null;
  offered_seat_codes: string[];
  booking_id: number | null;
  booked_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
  close_reason: WaitlistCloseReason | null;
  movie: { id: number; name: string; avatar: string } | null;
  branch: { id: number; name: string } | null;
  showtime: {
    id: number;
    movie_date: string;
    time_begin: string;
    time_end: string;
    room: string | null;
    status: 'ACTIVE' | 'CANCELLED';
  } | null;
}

export interface ShowtimeWaitlistStatus {
  schedule_id: number;
  total_seats: number;
  available_seats: number;
  full: boolean;
  waiting_count: number;
  max_seat_count: number;
  offer_minutes: number;
  can_join: boolean;
  reason: { code: string; message: string } | null;
  entry: WaitlistEntry | null;
}
