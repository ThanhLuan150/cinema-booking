
function isVoucherEligible(voucher, { cinemaId, orderValue }) {
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
  return { eligible: true };
}

function computeVoucherDiscount(voucher, orderValue) {
  return voucher.discount_type === 'percent'
    ? Math.round((Number(orderValue || 0) * voucher.discount_value) / 100)
    : voucher.discount_value;
}

module.exports = { isVoucherEligible, computeVoucherDiscount };
