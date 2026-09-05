const { isVoucherEligible, computeVoucherDiscount } = require('./voucherPricing');

function voucher(overrides = {}) {
  return {
    active: true,
    cinema_id: null,
    valid_from: null,
    valid_to: null,
    max_uses: null,
    used_count: 0,
    min_order_value: 0,
    discount_type: 'FIXED_AMOUNT',
    discount_value: 10000,
    ...overrides,
  };
}

describe('isVoucherEligible', () => {
  it('is ineligible when the voucher is missing or inactive', () => {
    expect(isVoucherEligible(null, {}).eligible).toBe(false);
    expect(isVoucherEligible(voucher({ active: false }), {}).eligible).toBe(false);
  });

  it('rejects a cinema-scoped voucher used for a different cinema', () => {
    const result = isVoucherEligible(voucher({ cinema_id: 5 }), { cinemaId: 6, orderValue: 100000 });
    expect(result).toEqual({ eligible: false, reason: 'VOUCHER_WRONG_CINEMA' });
  });

  it('accepts a cinema-scoped voucher used for its own cinema', () => {
    const result = isVoucherEligible(voucher({ cinema_id: 5 }), { cinemaId: 5, orderValue: 100000 });
    expect(result.eligible).toBe(true);
  });

  it('rejects a voucher that is not yet valid', () => {
    const result = isVoucherEligible(voucher({ valid_from: new Date(Date.now() + 86400000) }), { orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'VOUCHER_NOT_YET_VALID' });
  });

  it('rejects an expired voucher', () => {
    const result = isVoucherEligible(voucher({ valid_to: new Date(Date.now() - 86400000) }), { orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'VOUCHER_EXPIRED' });
  });

  it('rejects a voucher that has reached its usage limit', () => {
    const result = isVoucherEligible(voucher({ max_uses: 5, used_count: 5 }), { orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'VOUCHER_USES_EXHAUSTED' });
  });

  it('rejects an order below the minimum order value', () => {
    const result = isVoucherEligible(voucher({ min_order_value: 50000 }), { orderValue: 20000 });
    expect(result).toEqual({ eligible: false, reason: 'VOUCHER_MIN_ORDER_NOT_MET' });
  });

  it('is eligible when every condition is satisfied', () => {
    const result = isVoucherEligible(voucher({ min_order_value: 50000 }), { orderValue: 50000 });
    expect(result).toEqual({ eligible: true });
  });
});

describe('computeVoucherDiscount', () => {
  it('returns the flat amount for a fixed voucher', () => {
    expect(computeVoucherDiscount(voucher({ discount_type: 'FIXED_AMOUNT', discount_value: 10000 }), 100000)).toBe(10000);
  });

  it('computes a rounded percent discount', () => {
    expect(computeVoucherDiscount(voucher({ discount_type: 'PERCENTAGE', discount_value: 15 }), 99999)).toBe(
      Math.round((99999 * 15) / 100),
    );
  });
});
