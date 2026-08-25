const { resolveRefundPercent, calculateRefundAmount, REFUND_TIERS } = require('./refundPolicy');

describe('resolveRefundPercent', () => {
  it('grants 100% at or beyond the 24h tier', () => {
    expect(resolveRefundPercent(24)).toBe(100);
    expect(resolveRefundPercent(48)).toBe(100);
    expect(resolveRefundPercent(23.99)).not.toBe(100);
  });

  it('grants 50% between the 2h and 24h tiers', () => {
    expect(resolveRefundPercent(23.99)).toBe(50);
    expect(resolveRefundPercent(2)).toBe(50);
  });

  it('grants 0% inside the 2h window', () => {
    expect(resolveRefundPercent(1.99)).toBe(0);
    expect(resolveRefundPercent(0)).toBe(0);
  });

  it('grants 0% once the showtime has already started or passed', () => {
    expect(resolveRefundPercent(-0.01)).toBe(0);
    expect(resolveRefundPercent(-100)).toBe(0);
  });

  it('tiers are sorted highest minHours first (a precondition the resolver relies on)', () => {
    for (let i = 1; i < REFUND_TIERS.length; i += 1) {
      expect(REFUND_TIERS[i].minHours).toBeLessThan(REFUND_TIERS[i - 1].minHours);
    }
  });
});

describe('calculateRefundAmount', () => {
  it('computes the full amount at the 100% tier', () => {
    const result = calculateRefundAmount({ totalPrice: 200000, hoursUntilShowtime: 72 });
    expect(result).toEqual({ percent: 100, amount: 200000, eligible: true });
  });

  it('computes half the amount at the 50% tier', () => {
    const result = calculateRefundAmount({ totalPrice: 200000, hoursUntilShowtime: 10 });
    expect(result).toEqual({ percent: 50, amount: 100000, eligible: true });
  });

  it('is not eligible inside the 2h window, regardless of price', () => {
    const result = calculateRefundAmount({ totalPrice: 500000, hoursUntilShowtime: 1 });
    expect(result).toEqual({ percent: 0, amount: 0, eligible: false });
  });

  it('floors a non-integer amount rather than rounding up', () => {
    // 50% of 150001 = 75000.5 -> must floor to 75000, never hand back more than half.
    const result = calculateRefundAmount({ totalPrice: 150001, hoursUntilShowtime: 10 });
    expect(result.amount).toBe(75000);
  });

  it('never produces a negative amount for a zero or negative price', () => {
    expect(calculateRefundAmount({ totalPrice: 0, hoursUntilShowtime: 48 }).amount).toBe(0);
  });
});
