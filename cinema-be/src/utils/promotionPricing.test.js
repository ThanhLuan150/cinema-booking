const { isPromotionEligible, computePromotionDiscount, isGroupPromotion, pickBestPromotion } = require('./promotionPricing');

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

describe('group discount (min_tickets)', () => {
  it('needs at least min_tickets seats in the order', () => {
    const group = promotion({ min_tickets: 10 });
    expect(isPromotionEligible(group, { orderValue: 0, ticketCount: 9 })).toEqual({
      eligible: false,
      reason: 'PROMOTION_MIN_TICKETS_NOT_MET',
    });
    expect(isPromotionEligible(group, { orderValue: 0, ticketCount: 10 }).eligible).toBe(true);
  });

  it('refuses a group discount when the caller did not say how many seats the order has', () => {
    expect(isPromotionEligible(promotion({ min_tickets: 2 }), { orderValue: 0 }).reason).toBe('PROMOTION_MIN_TICKETS_NOT_MET');
  });

  it('leaves a promotion without a ticket minimum unaffected', () => {
    expect(isPromotionEligible(promotion({ min_tickets: null }), { orderValue: 0 }).eligible).toBe(true);
  });

  it('calls a promotion with a minimum of 2+ tickets a group promotion', () => {
    expect(isGroupPromotion(promotion({ min_tickets: 2 }))).toBe(true);
    expect(isGroupPromotion(promotion({ min_tickets: 1 }))).toBe(false);
    expect(isGroupPromotion(promotion({ min_tickets: null }))).toBe(false);
    expect(isGroupPromotion(null)).toBe(false);
  });
});

describe('pickBestPromotion', () => {
  const context = { orderValue: 1000000, ticketCount: 10, branchId: 1, movieId: 1, showtimeId: 7, comboIds: [] };

  it('picks the eligible promotion with the largest discount', () => {
    const candidates = [
      promotion({ id: 1, min_tickets: 5, discount_type: 'PERCENTAGE', discount_value: 5 }), // 50,000
      promotion({ id: 2, min_tickets: 10, discount_type: 'PERCENTAGE', discount_value: 10 }), // 100,000
      promotion({ id: 3, min_tickets: 20, discount_type: 'PERCENTAGE', discount_value: 30 }), // needs 20 seats
      promotion({ id: 4, min_tickets: 2, discount_type: 'FIXED_AMOUNT', discount_value: 80000 }),
    ];
    const best = pickBestPromotion(candidates, context);
    expect(best.promotion.id).toBe(2);
    expect(best.discount).toBe(100000);
  });

  it('breaks a tie on the lowest id so the quote and the checkout agree', () => {
    const candidates = [
      promotion({ id: 9, min_tickets: 2, discount_type: 'FIXED_AMOUNT', discount_value: 50000 }),
      promotion({ id: 4, min_tickets: 2, discount_type: 'FIXED_AMOUNT', discount_value: 50000 }),
    ];
    expect(pickBestPromotion(candidates, context).promotion.id).toBe(4);
  });

  it("skips a promotion the customer has used up, using each promotion's own usage count", () => {
    const candidates = [
      promotion({ id: 1, min_tickets: 2, per_customer_limit: 1, discount_value: 90000 }),
      promotion({ id: 2, min_tickets: 2, per_customer_limit: 1, discount_value: 10000 }),
    ];
    const best = pickBestPromotion(candidates, context, new Map([[1, 1]]));
    expect(best.promotion.id).toBe(2);
  });

  it('returns null when nothing applies', () => {
    expect(pickBestPromotion([promotion({ id: 1, min_tickets: 50 })], context)).toBeNull();
    expect(pickBestPromotion([], context)).toBeNull();
  });
});
