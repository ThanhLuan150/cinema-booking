export interface RealtimeState {
  cinemaPendingVersion: number;
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
