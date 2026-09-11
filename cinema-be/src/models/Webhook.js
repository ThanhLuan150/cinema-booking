const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Ledger of every inbound webhook call the platform has received, whatever the provider.
// This is the "did we already handle this event" source of truth (idempotency), the retry
// queue (status/attempts/next_attempt_at) and the error log (last_error) required by Ticket 41.
const webhookSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    integration_id: { type: Number, default: null, index: true },
    provider: { type: String, required: true, uppercase: true, trim: true, index: true },
    event: { type: String, required: true, trim: true },
    // The provider's own event/transaction id, used for idempotency. Deliberately has NO
    // `default` — it must be ABSENT (not null) on rows that don't have one, so the unique
    // sparse index below only applies to rows that actually carry one (see Notification's
    // dedupe_key for the same pattern).
    external_id: { type: String, trim: true },
    // Sanitized (secret/PII-redacted) copy of what the provider sent — see
    // webhook.service.sanitizePayload. Never the raw, unredacted body.
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    signature_verified: { type: Boolean, default: false },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'], default: 'PENDING', index: true },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 5 },
    last_attempt_at: { type: Date, default: null },
    next_attempt_at: { type: Date, default: null, index: true },
    processed_at: { type: Date, default: null },
    last_error: { type: String, default: null },
  },
  { timestamps: true },
);

// A plain `sparse: true` compound index only excludes a document missing ALL of its fields —
// since `provider` is always present, that would not skip rows that merely lack
// `external_id`. A partial index keyed on "external_id exists" is what actually reproduces
// the "unique only among rows that have one" behavior we want.
webhookSchema.index(
  { provider: 1, external_id: 1 },
  { unique: true, partialFilterExpression: { external_id: { $exists: true } } },
);

withCleanJSON(webhookSchema);

const Webhook = mongoose.model('Webhook', webhookSchema);
Webhook.STATUS = { PENDING: 'PENDING', PROCESSING: 'PROCESSING', SUCCESS: 'SUCCESS', FAILED: 'FAILED' };

module.exports = Webhook;
