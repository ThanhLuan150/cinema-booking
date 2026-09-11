const webhookService = require('../services/webhook.service');

// Ticket 41 — sweeps FAILED webhooks whose backoff window has elapsed and replays their
// processor, and resets any row stuck PROCESSING past the timeout (a crashed/hung attempt)
// back to FAILED so it re-enters the retry queue. A poll every few minutes is plenty since
// each row's own backoff/attempt budget already paces retries (see webhook.service).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function startWebhookRetrySweep() {
  const timer = setInterval(() => {
    webhookService.retryFailed().catch((err) => {
      console.error('[webhookRetrySweep] failed to retry webhooks', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startWebhookRetrySweep, SWEEP_INTERVAL_MS };
