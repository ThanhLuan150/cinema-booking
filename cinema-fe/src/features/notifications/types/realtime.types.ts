export interface RealtimeState {
  cinemaStatusVersion: number;
  ownerBookingVersion: number;
}

export interface CinemaEvent {
  name?: string;
}

export interface MovieEvent {
  name?: string;
}

export interface BookingEvent {
  amount?: number;
}

export interface ShowtimeChangeEvent {
  bookingId?: number;
  scheduleId?: number;
}
