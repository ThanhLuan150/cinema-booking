import { describe, expect, it } from 'vitest';
import type { InSeatMenuItem } from '../types/inSeat.types';
import {
  MAX_LINE_QUANTITY,
  cartCount,
  cartLines,
  cartTotal,
  decrement,
  increment,
  isActiveOrder,
  newIdempotencyKey,
  setQuantity,
  toOrderLines,
  trackIndex,
} from './inSeatCart';

const menu: InSeatMenuItem[] = [
  { id: 1, name: 'Large Popcorn', description: '', price: 65000, image: null, type: 'FOOD' },
  { id: 2, name: 'Coke', description: '', price: 30000, image: null, type: 'BEVERAGE' },
];

describe('in-seat cart', () => {
  it('adds and removes one at a time, dropping a line at zero', () => {
    let cart = increment({}, 1);
    cart = increment(cart, 1);
    cart = increment(cart, 2);
    expect(cart).toEqual({ 1: 2, 2: 1 });
    cart = decrement(cart, 2);
    expect(cart).toEqual({ 1: 2 });
    expect(decrement(cart, 2)).toEqual({ 1: 2 }); // never negative
  });

  it('caps a line at the server limit and ignores nonsense quantities', () => {
    expect(setQuantity({}, 1, 999)).toEqual({ 1: MAX_LINE_QUANTITY });
    expect(increment({ 1: MAX_LINE_QUANTITY }, 1)).toEqual({ 1: MAX_LINE_QUANTITY });
    expect(setQuantity({ 1: 3 }, 1, Number.NaN)).toEqual({});
    expect(setQuantity({}, 1, 2.7)).toEqual({ 1: 2 });
  });

  it('prices lines from the menu, in menu order, and skips items no longer on it', () => {
    const lines = cartLines({ 2: 1, 1: 2, 99: 4 }, menu);
    expect(lines.map((l) => [l.item.id, l.quantity, l.lineTotal])).toEqual([
      [1, 2, 130000],
      [2, 1, 30000],
    ]);
    expect(cartTotal(lines)).toBe(160000);
    expect(cartCount(lines)).toBe(3);
  });

  it('sends only what and how many — never a price', () => {
    const payload = toOrderLines(cartLines({ 1: 2, 2: 1 }, menu));
    expect(payload).toEqual([
      { combo_id: 1, quantity: 2 },
      { combo_id: 2, quantity: 1 },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/price|total/);
  });

  it('places statuses on the Paid -> Preparing -> Ready -> Delivered track', () => {
    expect(trackIndex('PAID')).toBe(0);
    expect(trackIndex('DELIVERED')).toBe(3);
    expect(trackIndex('PENDING')).toBe(-1);
    expect(trackIndex('CANCELLED')).toBe(-1);
    expect(isActiveOrder('READY')).toBe(true);
    expect(isActiveOrder('DELIVERED')).toBe(false);
  });

  it('makes a fresh idempotency key per checkout attempt', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
