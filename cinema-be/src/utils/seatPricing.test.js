const { priceForSeatType, SEAT_TYPE_PRICE_MULTIPLIER } = require('./seatPricing');

describe('priceForSeatType', () => {
  it('applies the regular multiplier (1x)', () => {
    expect(priceForSeatType(100000, 0)).toBe(100000);
  });

  it('applies the vip multiplier (1.2x)', () => {
    expect(priceForSeatType(100000, 1)).toBe(120000);
  });

  it('applies the couple multiplier (1.5x)', () => {
    expect(priceForSeatType(100000, 2)).toBe(150000);
  });

  it('rounds the result to the nearest integer', () => {
    expect(priceForSeatType(99999, 1)).toBe(Math.round(99999 * 1.2));
  });

  it('falls back to a 1x multiplier for an unknown seat type', () => {
    expect(priceForSeatType(50000, 99)).toBe(50000);
  });

  it('exposes the multiplier table', () => {
    expect(SEAT_TYPE_PRICE_MULTIPLIER).toEqual({ 0: 1, 1: 1.2, 2: 1.5 });
  });
});
