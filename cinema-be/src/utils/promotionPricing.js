// Shared eligibility + discount math for Promotion, used by both the /promotion/validate
// (preview) and /promotion/apply (consume-on-success) endpoints so the two can never disagree.
function isGroupPromotion(promotion) {
  return Boolean(promotion) && Number(promotion.min_tickets) >= 2;
}
function isPromotionEligible(
  promotion,
  { branchId, movieId, showtimeId, comboIds = [], orderValue, customerUsedCount = 0, ticketCount = 0 } = {},
) {
  if (!promotion) return { eligible: false, reason: 'PROMOTION_NOT_FOUND' };
  if (promotion.status !== 'ACTIVE') return { eligible: false, reason: 'PROMOTION_INACTIVE' };

  const now = new Date();
  if (promotion.start_at && now < promotion.start_at) {
    return { eligible: false, reason: 'PROMOTION_NOT_YET_VALID' };
  }
  if (promotion.end_at && now > promotion.end_at) {
    return { eligible: false, reason: 'PROMOTION_EXPIRED' };
  }
  if (promotion.usage_limit !== null && promotion.used_count >= promotion.usage_limit) {
    return { eligible: false, reason: 'PROMOTION_USAGE_LIMIT_REACHED' };
  }
  if (promotion.per_customer_limit !== null && customerUsedCount >= promotion.per_customer_limit) {
    return { eligible: false, reason: 'PROMOTION_CUSTOMER_LIMIT_REACHED' };
  }
  if (Number(orderValue || 0) < promotion.minimum_order_value) {
    return { eligible: false, reason: 'PROMOTION_MIN_ORDER_NOT_MET' };
  }
  if (promotion.min_tickets !== null && promotion.min_tickets !== undefined && Number(ticketCount || 0) < promotion.min_tickets) {
    return { eligible: false, reason: 'PROMOTION_MIN_TICKETS_NOT_MET' };
  }

  if (promotion.branch_ids.length > 0 && !promotion.branch_ids.includes(Number(branchId))) {
    return { eligible: false, reason: 'PROMOTION_BRANCH_NOT_ELIGIBLE' };
  }
  if (promotion.movie_ids.length > 0 && !promotion.movie_ids.includes(Number(movieId))) {
    return { eligible: false, reason: 'PROMOTION_MOVIE_NOT_ELIGIBLE' };
  }
  if (promotion.showtime_ids.length > 0 && !promotion.showtime_ids.includes(Number(showtimeId))) {
    return { eligible: false, reason: 'PROMOTION_SHOWTIME_NOT_ELIGIBLE' };
  }
  if (promotion.combo_ids.length > 0) {
    const orderComboIds = comboIds.map(Number);
    const hasEligibleCombo = promotion.combo_ids.some((id) => orderComboIds.includes(id));
    if (!hasEligibleCombo) return { eligible: false, reason: 'PROMOTION_COMBO_NOT_ELIGIBLE' };
  }

  return { eligible: true };
}

// Never trust a discount amount computed on the frontend — this is the single source of truth,
// called from both /validate (preview) and /apply (on order finalization).
function computePromotionDiscount(promotion, orderValue) {
  const value = Number(orderValue || 0);
  let discount =
    promotion.discount_type === 'PERCENTAGE'
      ? Math.round((value * promotion.discount_value) / 100)
      : promotion.discount_value;
  if (promotion.maximum_discount !== null && promotion.maximum_discount !== undefined) {
    discount = Math.min(discount, promotion.maximum_discount);
  }
  return Math.max(0, Math.min(discount, value));
}

// The group discount a group order gets without typing a code: of the candidate promotions, every
// eligible one (same rules as a typed code), the largest discount wins; ties go to the lowest id so the
// pick is stable between the quote and the checkout. Returns { promotion, discount } or null.
function pickBestPromotion(candidates, context, customerUsedCountById = new Map()) {
  let best = null;
  for (const promotion of candidates || []) {
    const eligibility = isPromotionEligible(promotion, {
      ...context,
      customerUsedCount: customerUsedCountById.get(promotion.id) || 0,
    });
    if (!eligibility.eligible) continue;
    const discount = computePromotionDiscount(promotion, context.orderValue);
    if (discount <= 0) continue;
    if (!best || discount > best.discount || (discount === best.discount && promotion.id < best.promotion.id)) {
      best = { promotion, discount };
    }
  }
  return best;
}

module.exports = { isPromotionEligible, computePromotionDiscount, isGroupPromotion, pickBestPromotion };
