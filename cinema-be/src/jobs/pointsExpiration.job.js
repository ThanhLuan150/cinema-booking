const loyaltyService = require('../services/loyaltyService');

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // once an hour is plenty for a day-granularity expiry window

function startPointsExpirationSweep() {
  const timer = setInterval(() => {
    loyaltyService.expirePoints().catch((err) => {
      console.error('[pointsExpirationSweep] failed to expire loyalty points', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startPointsExpirationSweep, SWEEP_INTERVAL_MS };
