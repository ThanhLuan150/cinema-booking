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
  memberDiscount,
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

  it('estimates the member F&B discount like the server: rounded per item, times the quantity', () => {
    const lines = cartLines({ 1: 2, 2: 1 }, menu);
    expect(memberDiscount(lines, 10)).toBe(6500 * 2 + 3000);
    // 65,000 x 15% = 9,750 per popcorn; 30,000 x 15% = 4,500
    expect(memberDiscount(lines, 15)).toBe(9750 * 2 + 4500);
    // Per-item rounding, not on the total: 3 x round(333 x 0.5) = 3 x 167, not round(999 x 0.5) = 500.
    const cheap = cartLines({ 7: 3 }, [{ id: 7, name: 'Candy', description: '', price: 333, image: null, type: 'FOOD' }]);
    expect(memberDiscount(cheap, 50)).toBe(501);
  });

  it('gives no discount without a member percentage, and never more than the item', () => {
    const lines = cartLines({ 1: 1 }, menu);
    expect(memberDiscount(lines, 0)).toBe(0);
    expect(memberDiscount(lines, undefined)).toBe(0);
    expect(memberDiscount(lines, 100)).toBe(65000);
    expect(memberDiscount([], 10)).toBe(0);
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
