const HOLD_TTL_MS = Number(process.env.SEAT_HOLD_TTL_MS) || 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = Number(process.env.SEAT_HOLD_SWEEP_INTERVAL_MS) || 30 * 1000;

module.exports = { HOLD_TTL_MS, SWEEP_INTERVAL_MS };
