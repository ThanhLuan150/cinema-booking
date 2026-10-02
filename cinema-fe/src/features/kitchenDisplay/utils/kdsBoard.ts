import type { KdsBranch, KdsOrder, KdsStatus, KdsTargetStatus } from '../types/kds.types';

export const KDS_ACTIVE_STATUSES: KdsStatus[] = ['NEW', 'PREPARING', 'READY'];
export const KDS_DONE_STATUSES: KdsStatus[] = ['COMPLETED', 'CANCELLED'];

export type KdsLane = 'NEW' | 'PREPARING' | 'READY' | 'DONE';
export const KDS_LANES: KdsLane[] = ['NEW', 'PREPARING', 'READY', 'DONE'];

/** Minutes an active order may wait before its card turns amber / red. */
export const KDS_WARN_AFTER_MINUTES = 10;
export const KDS_LATE_AFTER_MINUTES = 20;

export type KdsUrgency = 'normal' | 'warning' | 'late';

export const KDS_STATUS_CLASS: Record<KdsStatus, string> = {
  NEW: 'bg-blue-500/20 text-blue-300',
  PREPARING: 'bg-orange-500/20 text-orange-300',
  READY: 'bg-purple-500/20 text-purple-300',
  COMPLETED: 'bg-green-600/20 text-green-300',
  CANCELLED: 'bg-gray-500/20 text-gray-300',
};

function timeOf(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Splits the board into lanes. Active lanes are first-in, first-out by the time the order reached
 * the kitchen (payment), so the oldest ticket is always on top; the done lane shows the most recently
 * finished first.
 */
export function groupOrdersByLane(orders: KdsOrder[]): Record<KdsLane, KdsOrder[]> {
  const lanes: Record<KdsLane, KdsOrder[]> = { NEW: [], PREPARING: [], READY: [], DONE: [] };
  for (const order of orders) {
    lanes[laneOf(order.status)].push(order);
  }
  for (const lane of ['NEW', 'PREPARING', 'READY'] as const) {
    lanes[lane].sort((a, b) => timeOf(a.timestamps.NEW) - timeOf(b.timestamps.NEW) || a.id - b.id);
  }
  lanes.DONE.sort(
    (a, b) => timeOf(b.status_changed_at) - timeOf(a.status_changed_at) || b.id - a.id,
  );
  return lanes;
}

/**
 * Which kitchen a viewer who is not tied to one branch (the Super Admin) opens first: the one with the
 * most orders waiting, ties going to the earlier branch in the list. Null when there is no branch.
 */
export function pickDefaultBranchId(branches: KdsBranch[]): number | null {
  let best: KdsBranch | null = null;
  for (const branch of branches) {
    if (!best || branch.active > best.active) best = branch;
  }
  return best ? best.id : null;
}

/** Whole minutes between `from` and `nowMs` (never negative, 0 when unknown). */
export function minutesSince(from: string | null | undefined, nowMs: number): number {
  const start = timeOf(from);
  if (!start) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 60_000));
}

/** How long an active order has been waiting since it reached the kitchen; done orders are never late. */
export function urgencyOf(order: KdsOrder, nowMs: number): KdsUrgency {
  if (!KDS_ACTIVE_STATUSES.includes(order.status)) return 'normal';
  const waited = minutesSince(order.timestamps.NEW, nowMs);
  if (waited >= KDS_LATE_AFTER_MINUTES) return 'late';
  if (waited >= KDS_WARN_AFTER_MINUTES) return 'warning';
  return 'normal';
}

/** The forward step the card's main button performs (cancel is a separate, secondary action). */
export function primaryNextStatus(order: KdsOrder): KdsTargetStatus | null {
  return order.next_statuses.find((status) => status !== 'CANCELLED') ?? null;
}

export function canCancel(order: KdsOrder): boolean {
  return order.next_statuses.includes('CANCELLED');
}

/** The lane an order in `status` is shown in. */
export function laneOf(status: KdsStatus): KdsLane {
  return KDS_DONE_STATUSES.includes(status) ? 'DONE' : (status as KdsLane);
}

/**
 * Where a card may be dragged: only into the lane of its next forward step (NEW -> Preparing,
 * PREPARING -> Ready, READY -> Done = complete), never skipping a lane or going back — the same rule
 * the server enforces. Cancelling is never a drop: it needs a reason, so it stays a button.
 */
export function dropTargetFor(order: KdsOrder): { lane: KdsLane; status: KdsTargetStatus } | null {
  const status = primaryNextStatus(order);
  return status ? { lane: laneOf(status), status } : null;
}

/**
 * Offset to add to the local clock so elapsed timers agree with the server's clock (a kitchen tablet's
 * clock is often minutes off). `receivedAtMs` is when the board response arrived.
 */
export function serverClockOffset(serverTime: string | undefined, receivedAtMs: number): number {
  const server = timeOf(serverTime);
  return server ? server - receivedAtMs : 0;
}

/** "HH:mm" in the viewer's locale for a timestamp, or an em dash. */
export function formatClock(value: string | null | undefined, locale?: string): string {
  const ms = timeOf(value);
  if (!ms) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}
