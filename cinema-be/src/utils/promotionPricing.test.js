const { isPromotionEligible, computePromotionDiscount } = require('./promotionPricing');

function promotion(overrides = {}) {
  return {
    status: 'ACTIVE',
    start_at: new Date(Date.now() - 86400000),
    end_at: new Date(Date.now() + 86400000),
    usage_limit: null,
    used_count: 0,
    per_customer_limit: null,
    minimum_order_value: 0,
    discount_type: 'FIXED_AMOUNT',
    discount_value: 10000,
    maximum_discount: null,
    branch_ids: [],
    movie_ids: [],
    showtime_ids: [],
    combo_ids: [],
    ...overrides,
  };
}

describe('isPromotionEligible', () => {
  it('is ineligible when the promotion is missing or inactive', () => {
    expect(isPromotionEligible(null, {}).eligible).toBe(false);
    expect(isPromotionEligible(promotion({ status: 'INACTIVE' }), {}).eligible).toBe(false);
  });

  it('rejects a promotion that is not yet valid', () => {
    const result = isPromotionEligible(promotion({ start_at: new Date(Date.now() + 86400000) }), { orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_NOT_YET_VALID' });
  });

  it('rejects an expired promotion', () => {
    const result = isPromotionEligible(promotion({ end_at: new Date(Date.now() - 86400000) }), { orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_EXPIRED' });
  });

  it('rejects a promotion that has reached its total usage limit', () => {
    const result = isPromotionEligible(promotion({ usage_limit: 5, used_count: 5 }), { orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_USAGE_LIMIT_REACHED' });
  });

  it('rejects a customer who has reached their own per-customer limit', () => {
    const result = isPromotionEligible(promotion({ per_customer_limit: 1 }), {
      orderValue: 0,
      customerUsedCount: 1,
    });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_CUSTOMER_LIMIT_REACHED' });
  });

  it('allows a customer still under their per-customer limit', () => {
    const result = isPromotionEligible(promotion({ per_customer_limit: 2 }), {
      orderValue: 0,
      customerUsedCount: 1,
    });
    expect(result.eligible).toBe(true);
  });

  it('rejects an order below the minimum order value', () => {
    const result = isPromotionEligible(promotion({ minimum_order_value: 50000 }), { orderValue: 20000 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_MIN_ORDER_NOT_MET' });
  });

  it('rejects a branch-restricted promotion used at a different branch', () => {
    const result = isPromotionEligible(promotion({ branch_ids: [5] }), { branchId: 6, orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_BRANCH_NOT_ELIGIBLE' });
  });

  it('accepts a branch-restricted promotion used at an eligible branch', () => {
    const result = isPromotionEligible(promotion({ branch_ids: [5, 6] }), { branchId: 6, orderValue: 0 });
    expect(result.eligible).toBe(true);
  });

  it('rejects a movie-restricted promotion for a different movie', () => {
    const result = isPromotionEligible(promotion({ movie_ids: [10] }), { movieId: 11, orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_MOVIE_NOT_ELIGIBLE' });
  });

  it('rejects a showtime-restricted promotion for a different showtime', () => {
    const result = isPromotionEligible(promotion({ showtime_ids: [20] }), { showtimeId: 21, orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_SHOWTIME_NOT_ELIGIBLE' });
  });

  it('rejects a combo-restricted promotion when none of the ordered combos qualify', () => {
    const result = isPromotionEligible(promotion({ combo_ids: [30, 31] }), { comboIds: [99], orderValue: 0 });
    expect(result).toEqual({ eligible: false, reason: 'PROMOTION_COMBO_NOT_ELIGIBLE' });
  });

  it('accepts a combo-restricted promotion when at least one ordered combo qualifies', () => {
    const result = isPromotionEligible(promotion({ combo_ids: [30, 31] }), { comboIds: [31, 99], orderValue: 0 });
    expect(result.eligible).toBe(true);
  });

  it('is eligible when every condition is satisfied and no scope restrictions apply', () => {
    const result = isPromotionEligible(promotion({ minimum_order_value: 50000 }), { orderValue: 50000 });
    expect(result).toEqual({ eligible: true });
  });
});

describe('computePromotionDiscount', () => {
  it('returns the flat amount for a fixed-amount promotion', () => {
    expect(computePromotionDiscount(promotion({ discount_type: 'FIXED_AMOUNT', discount_value: 10000 }), 100000)).toBe(
      10000,
    );
  });

  it('computes a rounded percentage discount', () => {
    expect(
      computePromotionDiscount(promotion({ discount_type: 'PERCENTAGE', discount_value: 15 }), 99999),
    ).toBe(Math.round((99999 * 15) / 100));
  });

  it('caps a percentage discount at maximum_discount', () => {
    const discount = computePromotionDiscount(
      promotion({ discount_type: 'PERCENTAGE', discount_value: 50, maximum_discount: 20000 }),
      100000,
    );
    expect(discount).toBe(20000);
  });

  it('never discounts more than the order value itself', () => {
    expect(computePromotionDiscount(promotion({ discount_type: 'FIXED_AMOUNT', discount_value: 50000 }), 10000)).toBe(
      10000,
    );
  });
});
