// Shared eligibility + discount math for Voucher, used by both the /voucher/validate (preview)
// endpoint and computeOrderPricing (booking/box-office/kiosk checkout) so the two can never
// disagree. FREE_TICKET/FREE_COMBO need the order's actual per-ticket/per-combo prices — those
// are only ever computed from real ticket/combo ids server-side (never trusted from the FE).

function isVoucherEligible(voucher, { cinemaId, orderValue, comboIds = [] } = {}) {
  if (!voucher || !voucher.active) return { eligible: false, reason: 'VOUCHER_NOT_FOUND' };
  if (voucher.cinema_id !== null && Number(cinemaId) !== voucher.cinema_id) {
    return { eligible: false, reason: 'VOUCHER_WRONG_CINEMA' };
  }
  const now = new Date();
  if (voucher.valid_from && now < voucher.valid_from) {
    return { eligible: false, reason: 'VOUCHER_NOT_YET_VALID' };
  }
  if (voucher.valid_to && now > voucher.valid_to) {
    return { eligible: false, reason: 'VOUCHER_EXPIRED' };
  }
  if (voucher.max_uses !== null && voucher.used_count >= voucher.max_uses) {
    return { eligible: false, reason: 'VOUCHER_USES_EXHAUSTED' };
  }
  if (Number(orderValue || 0) < voucher.min_order_value) {
    return { eligible: false, reason: 'VOUCHER_MIN_ORDER_NOT_MET' };
  }
  if (voucher.discount_type === 'FREE_COMBO') {
    const orderComboIds = (comboIds || []).map(Number);
    const hasEligibleCombo =
      voucher.combo_id !== null && voucher.combo_id !== undefined
        ? orderComboIds.includes(voucher.combo_id)
        : orderComboIds.length > 0;
    if (!hasEligibleCombo) return { eligible: false, reason: 'VOUCHER_COMBO_NOT_ELIGIBLE' };
  }
  return { eligible: true };
}

// Never trust a discount amount computed on the frontend — this is the single source of truth.
// `ticketPrices` (array of numbers) and `combos` (array of {id, price}) must come from the
// backend's own pricing of the real order items — see booking.repository.priceOrderItems.
function computeVoucherDiscount(voucher, orderValue, { ticketPrices = [], combos = [] } = {}) {
  const value = Number(orderValue || 0);
  switch (voucher.discount_type) {
    case 'PERCENTAGE':
      return Math.round((value * voucher.discount_value) / 100);
    case 'FREE_TICKET': {
      const quantity = Math.max(1, Number(voucher.free_quantity) || 1);
      const sorted = [...ticketPrices].sort((a, b) => a - b);
      return sorted.slice(0, quantity).reduce((sum, price) => sum + price, 0);
    }
    case 'FREE_COMBO': {
      const eligibleCombos =
        voucher.combo_id !== null && voucher.combo_id !== undefined
          ? combos.filter((c) => c.id === voucher.combo_id)
          : combos;
      const quantity = Math.max(1, Number(voucher.free_quantity) || 1);
      const sorted = [...eligibleCombos].sort((a, b) => a.price - b.price);
      return sorted.slice(0, quantity).reduce((sum, c) => sum + c.price, 0);
    }
    case 'FIXED_AMOUNT':
    default:
      return voucher.discount_value;
  }
}

module.exports = { isVoucherEligible, computeVoucherDiscount };
