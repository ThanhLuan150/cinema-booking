export type KdsStatus = 'NEW' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

/** A status the KDS may move an order to (never back to NEW). */
export type KdsTargetStatus = Exclude<KdsStatus, 'NEW'>;

export interface KdsOrderItem {
  combo_id: number;
  name: string;
  quantity: number;
}

export interface KdsBookingInfo {
  id: number;
  code: string;
  seats: string[];
  room: string | null;
  showtime: { date: string; time: string } | null;
}

export interface KdsDelivery {
  type: 'SEAT';
  seat: string;
  room: string | null;
  showtime: { date: string; time: string } | null;
}

/** The kitchen's view of a paid combo order. Deliberately carries no prices. */
export interface KdsOrder {
  id: number;
  code: string;
  branch_id: number;
  status: KdsStatus;
  items: KdsOrderItem[];
  item_count: number;
  created_at: string;
  status_changed_at: string | null;
  timestamps: Record<KdsStatus, string | null>;
  customer: { id: number; name: string | null } | null;
  booking: KdsBookingInfo | null;
  /** 'IN_SEAT' when the customer ordered from their seat (null for counter / booking combos). */
  channel?: 'IN_SEAT' | null;
  /** In-seat orders: the exact seat to walk the finished order to. */
  delivery?: KdsDelivery | null;
  cancel_reason: string | null;
  /** Server-computed allowed next statuses — the single source of truth for which buttons show. */
  next_statuses: KdsTargetStatus[];
}

export interface KdsBoard {
  branch_id: number;
  server_time: string;
  recent_minutes: number;
  statuses: KdsStatus[];
  counts: Record<KdsStatus, number>;
  truncated: boolean;
  orders: KdsOrder[];
}

/** A branch whose KDS the viewer may open, with how many orders are waiting in its kitchen. */
export interface KdsBranch {
  id: number;
  name: string;
  status: string;
  counts: Record<'NEW' | 'PREPARING' | 'READY', number>;
  active: number;
}

export interface KdsBoardParams {
  status?: KdsStatus[];
  recentMinutes?: number;
}

export interface UpdateKdsStatusPayload {
  status: KdsTargetStatus;
  reason?: string;
}
