import type { InSeatMenuItem, InSeatOrderLine, InSeatOrderStatus } from '../types/inSeat.types';

/** combo_id -> quantity. Only positive quantities are ever stored. */
export type InSeatCart = Record<number, number>;

// Mirrors the server's per-line cap (inSeatOrder.service MAX_LINE_QUANTITY) so the stepper stops
// where the server would refuse.
export const MAX_LINE_QUANTITY = 20;

export function setQuantity(cart: InSeatCart, comboId: number, quantity: number): InSeatCart {
  const next = { ...cart };
  const clamped = Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(Number(quantity) || 0)));
  if (clamped === 0) delete next[comboId];
  else next[comboId] = clamped;
  return next;
}

export const increment = (cart: InSeatCart, comboId: number) =>
  setQuantity(cart, comboId, (cart[comboId] ?? 0) + 1);
export const decrement = (cart: InSeatCart, comboId: number) =>
  setQuantity(cart, comboId, (cart[comboId] ?? 0) - 1);

export interface InSeatCartLine {
  item: InSeatMenuItem;
  quantity: number;
  lineTotal: number;
}

/** The cart in menu order. A combo that left the menu (sold out / retired) silently drops out. */
export function cartLines(cart: InSeatCart, menu: InSeatMenuItem[]): InSeatCartLine[] {
  return menu
    .filter((item) => (cart[item.id] ?? 0) > 0)
    .map((item) => ({ item, quantity: cart[item.id], lineTotal: item.price * cart[item.id] }));
}

/** Display-only estimate: the server prices the order again and its total is what MoMo charges. */
export const cartTotal = (lines: InSeatCartLine[]) =>
  lines.reduce((sum, line) => sum + line.lineTotal, 0);
export const cartCount = (lines: InSeatCartLine[]) =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

/** What is sent to the server: what and how many, never a price. */
export function toOrderLines(lines: InSeatCartLine[]): InSeatOrderLine[] {
  return lines.map(({ item, quantity }) => ({ combo_id: item.id, quantity }));
}

// The customer-facing progress of an order, in order. CANCELLED and PENDING sit outside the track.
export const ORDER_TRACK: InSeatOrderStatus[] = ['PAID', 'PREPARING', 'READY', 'DELIVERED'];

/** 0-based position on ORDER_TRACK, or -1 when the order is not on it (unpaid / cancelled). */
export const trackIndex = (status: InSeatOrderStatus) => ORDER_TRACK.indexOf(status);

export const isActiveOrder = (status: InSeatOrderStatus) =>
  status === 'PENDING' || status === 'PAID' || status === 'PREPARING' || status === 'READY';

export function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `inseat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
