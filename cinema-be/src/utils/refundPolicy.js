// Tiered cancellation/refund policy: the closer a booking's showtime is, the smaller the
// refund. Mirrors the existing hard 2h cancellation cutoff (booking.controller.js:
// CANCEL_WINDOW_EXPIRED) but replaces its yes/no cutoff with graduated percentages — under 2h
// still resolves to 0% (not eligible), same behavior as before.
const REFUND_TIERS = [
  { minHours: 24, percent: 100 },
  { minHours: 2, percent: 50 },
];

// Highest-percent tier whose minHours the booking still clears; 0 once inside the innermost
// tier's window (including a showtime that has already started/passed). `tiers` defaults to
// REFUND_TIERS but Ticket 27 lets a caller pass the resolved REFUND_POLICY setting instead
// (see refund.controller.js) — sorted defensively so storage order never matters.
function resolveRefundPercent(hoursUntilShowtime, tiers = REFUND_TIERS) {
  const sorted = [...tiers].sort((a, b) => b.minHours - a.minHours);
  for (const tier of sorted) {
    if (hoursUntilShowtime >= tier.minHours) return tier.percent;
  }
  return 0;
}

// Always computed server-side from the booking's own total_price and the showtime's own
// timing — the amount a refund request ends up with never depends on anything the client sent.
function calculateRefundAmount({ totalPrice, hoursUntilShowtime, tiers = REFUND_TIERS }) {
  const percent = resolveRefundPercent(hoursUntilShowtime, tiers);
  const amount = Math.floor((totalPrice * percent) / 100);
  return { percent, amount, eligible: percent > 0 };
}

module.exports = { REFUND_TIERS, resolveRefundPercent, calculateRefundAmount };
