const giftCardService = require('../services/giftCard.service');

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // once an hour is plenty for a day-granularity expiry window

function startGiftCardExpirationSweep() {
  const timer = setInterval(() => {
    giftCardService.expireGiftCards().catch((err) => {
      console.error('[giftCardExpirationSweep] failed to expire gift cards', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startGiftCardExpirationSweep, SWEEP_INTERVAL_MS };
