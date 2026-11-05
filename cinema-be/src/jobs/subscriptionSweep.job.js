const subscriptionService = require('../services/subscription.service');

// Ends subscriptions whose term is over and withdraws purchases whose payment window lapsed. Benefit
// checks compare end_at themselves, so a late sweep never lets an expired subscription be used —
// this keeps `status` (and the one-open-subscription slot) truthful.
const SWEEP_INTERVAL_MS = 60 * 1000;

function startSubscriptionSweep() {
  const timer = setInterval(() => {
    subscriptionService.expireSubscriptions().catch((err) => {
      console.error('[subscriptionSweep] failed to expire subscriptions', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startSubscriptionSweep, SWEEP_INTERVAL_MS };
