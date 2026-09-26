import type { RealtimeAction } from '@/lib/realtimeEvents';

// Monotonic counters a page can depend on to re-run a fetch it owns itself (i.e. anything not
// held in react-query). RealtimeBridge bumps them; components select the one they care about.
export interface RealtimeState {
  cinemaStatusVersion: number;
  ownerBookingVersion: number;
  seatMapVersion: number;
  checkinVersion: number;
  operationsVersion: number;
  catalogueVersion: number;
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

// Sent only to the employee a shift assignment is about (account room).
export interface MyShiftEvent {
  action?: RealtimeAction;
  id?: number;
  date?: string;
  startAt?: string;
  endAt?: string;
  positionId?: number;
  status?: 'ACTIVE' | 'CANCELLED';
}

// A stock movement at the branch. `lowStock` is true only on the write that carries an item INTO
// low/out of stock (the server compares against the previous status), so it is safe to toast on.
export interface InventoryEvent {
  item?: string;
  quantity?: number;
  status?: string;
  lowStock?: boolean;
}

export interface ShowtimeChangeEvent {
  bookingId?: number;
  scheduleId?: number;
}

// The live seat map. Deliberately identity-free: it says which seats moved and where to, never
// who moved them, so the room is safe for the anonymous sockets that also watch a seat grid.
export interface SeatUpdateEvent {
  scheduleId?: number;
  seatCodes?: string[];
  status?: 'HELD' | 'AVAILABLE' | 'BOOKED';
}

// The shape every `<domain>:updated` event shares. Domain-specific extras (status, code, name,
// …) ride along untyped because each listener only ever forwards them to a refetch.
export interface DomainUpdateEvent {
  action?: RealtimeAction;
  scope?: string;
  id?: number;
  branchId?: number | null;
  status?: string;
  name?: string;
  title?: string;
  code?: string;
  [key: string]: unknown;
}
