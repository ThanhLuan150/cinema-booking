const notificationService = require('../services/notification.service');

// Ticket 25 — re-attempts delivery for notifications whose EMAIL channel failed. The row is
// already visible in-app; this sweep only chases the outbound copy. Backoff and the attempt
// budget live on each row (notification.service), so a poll every few minutes is plenty.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function startNotificationRetrySweep() {
  const timer = setInterval(() => {
    notificationService.retryFailed().catch((err) => {
      console.error('[notificationRetrySweep] failed to retry notifications', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startNotificationRetrySweep, SWEEP_INTERVAL_MS };
