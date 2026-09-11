const nextId = require('../utils/nextId');
const webhookRepository = require('../repositories/webhook.repository');
const Webhook = require('../models/Webhook');
const { withTimeout } = require('../utils/withTimeout');

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_ATTEMPTS = 5;
// A row left PROCESSING longer than this means the process crashed or hung mid-attempt
// (never reached markSuccess/markFailed) — the retry sweep resets it back to FAILED.
const PROCESSING_STALE_MS = 2 * 60 * 1000;

// provider (uppercased) -> async (payload, webhookRow) => any. Populated at startup by
// whichever module owns that provider's business logic (see booking.controller for MOMO).
const processors = new Map();

function registerProcessor(provider, handler) {
  processors.set(String(provider).toUpperCase(), handler);
}

// No business logic wired for this provider (yet) — receiving and logging the event is the
// whole job, e.g. a delivery-status callback from an email/SMS provider we only audit.
async function defaultProcessor() {
  return { acknowledged: true };
}

// Same exponential-backoff shape as notification.service: 30s, 1m, 2m, 4m, ... capped at 1h.
function backoffFor(attempts) {
  return Math.min(60 * 60 * 1000, 30 * 1000 * 2 ** Math.max(0, attempts - 1));
}

function nextAttemptFor(attempts, maxAttempts) {
  return attempts >= maxAttempts ? null : new Date(Date.now() + backoffFor(attempts));
}

const REDACT_KEY_RE = /pass(word)?|secret|token|api[-_]?key|card(number)?|cvv|\bpin\b|authorization/i;

// Strips anything that looks like a credential before it is ever written to the Webhook
// ledger — "không expose secret key" / "không lưu sensitive data không cần thiết". The
// ledger only needs enough of the payload to debug/replay processing, never raw secrets.
function sanitizePayload(value, depth = 0) {
  if (value === null || value === undefined || depth > 6) return value ?? null;
  if (Array.isArray(value)) return value.map((v) => sanitizePayload(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = REDACT_KEY_RE.test(key) ? '[REDACTED]' : sanitizePayload(val, depth + 1);
    }
    return out;
  }
  return value;
}

function normalizeExternalId(externalId) {
  return externalId === undefined || externalId === null || externalId === '' ? undefined : String(externalId);
}

// Runs the registered processor for an already-claimed (status PROCESSING) row, with a
// timeout, and records the outcome. On failure the row is marked FAILED with a scheduled
// retry and the error is re-thrown — callers decide whether to let that propagate (MoMo's
// live IPN does, to keep its existing error-surfacing behavior) or acknowledge receipt
// anyway and rely on the retry sweep (the generic /api/webhooks/:provider endpoint does).
async function runProcessor(webhookRow, payload) {
  const handler = processors.get(webhookRow.provider) || defaultProcessor;
  // Read off `module.exports` (not the closed-over constant) so tests can override the
  // timeout for a single case without needing a config knob threaded through every caller.
  const timeoutMs = module.exports.DEFAULT_TIMEOUT_MS;
  try {
    const result = await withTimeout(
      Promise.resolve().then(() => handler(payload, webhookRow)),
      timeoutMs,
      `Webhook processing timed out after ${timeoutMs}ms`,
    );
    const webhook = await webhookRepository.markSuccess(webhookRow.id);
    return { webhook, success: true, result };
  } catch (err) {
    console.error('[webhook] processing failed', webhookRow.provider, webhookRow.event, webhookRow.id, err.message);
    const nextAttemptAt = nextAttemptFor(webhookRow.attempts || 1, webhookRow.max_attempts || DEFAULT_MAX_ATTEMPTS);
    const webhook = await webhookRepository.markFailed(webhookRow.id, err.message, { nextAttemptAt });
    const error = new Error(err.message);
    error.webhook = webhook;
    error.cause = err;
    throw error;
  }
}

// Full inbound pipeline for the generic endpoint: dedupe -> claim -> process -> record
// outcome. See webhook.controller.receive for the signature-verification step that runs
// before this (a bad signature never reaches the ledger at all).
async function receiveWebhook({
  provider,
  event,
  externalId,
  payload,
  integrationId = null,
  signatureVerified = false,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  const created = await webhookRepository.create({
    id: await nextId('webhook'),
    integration_id: integrationId,
    provider: String(provider).toUpperCase(),
    event,
    external_id: normalizeExternalId(externalId),
    payload: sanitizePayload(payload),
    signature_verified: !!signatureVerified,
    max_attempts: maxAttempts,
  });

  if (created.status === Webhook.STATUS.SUCCESS) {
    return { webhook: created, duplicate: true };
  }

  const claimed = await webhookRepository.claimForProcessing(created.id);
  if (!claimed) {
    // Lost the claim race: another delivery of the same event is already PROCESSING it (or
    // just finished). Either way, running the processor again here would double-process.
    const fresh = await webhookRepository.findById(created.id);
    return {
      webhook: fresh,
      duplicate: fresh?.status === Webhook.STATUS.SUCCESS,
      inProgress: fresh?.status === Webhook.STATUS.PROCESSING,
    };
  }

  return runProcessor(claimed, payload);
}

// Re-runs a FAILED webhook's processor against its originally stored (already sanitized)
// payload. Used by both the retry sweep and a manual admin "retry" action.
async function retryWebhook(webhookRow) {
  const claimed = await webhookRepository.claimForProcessing(webhookRow.id);
  if (!claimed) return { webhook: webhookRow, inProgress: true };
  return runProcessor(claimed, webhookRow.payload);
}

async function retryFailed({ now = new Date(), limit = 50 } = {}) {
  const cutoff = new Date(now.getTime() - PROCESSING_STALE_MS);
  const stale = await webhookRepository.findStaleProcessing(cutoff);
  for (const row of stale) {
    await webhookRepository.resetStaleToFailed(row.id).catch(() => {});
  }

  const retryable = await webhookRepository.findRetryable(now, limit);
  const results = [];
  for (const row of retryable) {
    try {
      results.push(await retryWebhook(row));
    } catch (err) {
      results.push({ webhook: err.webhook || row, success: false, error: err.message });
    }
  }
  return results;
}

// Best-effort observability hook for handlers (like MoMo's IPN) that already own their full
// idempotency/processing/response logic and just want a ledger entry alongside it — never
// throws, so a ledger write failure can never take down the real payment/booking transaction
// it is merely logging ("webhook failure không được làm mất transaction chính").
async function logReceived({ provider, event, externalId, payload, signatureVerified = false }) {
  try {
    return await webhookRepository.create({
      id: await nextId('webhook'),
      provider: String(provider).toUpperCase(),
      event,
      external_id: normalizeExternalId(externalId),
      payload: sanitizePayload(payload),
      signature_verified: !!signatureVerified,
      status: Webhook.STATUS.PROCESSING,
      attempts: 1,
      last_attempt_at: new Date(),
    });
  } catch (err) {
    console.error('[webhook] failed to log received event', provider, event, err.message);
    return null;
  }
}

async function logOutcome(webhookLog, { success, error = null } = {}) {
  if (!webhookLog) return null;
  try {
    if (success) return await webhookRepository.markSuccess(webhookLog.id);
    const nextAttemptAt = nextAttemptFor(webhookLog.attempts || 1, webhookLog.max_attempts || DEFAULT_MAX_ATTEMPTS);
    return await webhookRepository.markFailed(webhookLog.id, error || 'Unknown error', { nextAttemptAt });
  } catch (err) {
    console.error('[webhook] failed to log outcome', webhookLog.id, err.message);
    return null;
  }
}

module.exports = {
  registerProcessor,
  receiveWebhook,
  retryWebhook,
  retryFailed,
  logReceived,
  logOutcome,
  sanitizePayload,
  backoffFor,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_ATTEMPTS,
};
