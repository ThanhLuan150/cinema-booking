const Webhook = require('../models/Webhook');

// Inserts a new webhook row. If a row for this (provider, external_id) already exists, this
// is a duplicate delivery — return the existing row instead of creating a second one (this is
// the DB-level half of "never process a duplicate event"; the other half is
// webhook.service.receiveWebhook not re-running the processor for a row already SUCCESS).
async function create(data) {
  try {
    return await Webhook.create(data);
  } catch (err) {
    if (err.code === 11000 && data.provider && data.external_id !== undefined) {
      const existing = await findByProviderAndExternalId(data.provider, data.external_id);
      if (existing) return existing;
    }
    throw err;
  }
}

async function findById(id) {
  return Webhook.findOne({ id: Number(id) });
}

async function findByProviderAndExternalId(provider, externalId) {
  if (externalId === undefined || externalId === null || externalId === '') return null;
  return Webhook.findOne({ provider: String(provider).toUpperCase().trim(), external_id: externalId });
}

// Atomic compare-and-set: only a row that is PENDING or FAILED can be claimed for
// (re)processing. A concurrent second claim attempt (two deliveries of the same event
// arriving at once) loses the race and gets null back — the caller must treat that as
// "someone else is already handling this" and not run the processor again.
async function claimForProcessing(id) {
  return Webhook.findOneAndUpdate(
    { id: Number(id), status: { $in: [Webhook.STATUS.PENDING, Webhook.STATUS.FAILED] } },
    { $set: { status: Webhook.STATUS.PROCESSING, last_attempt_at: new Date() }, $inc: { attempts: 1 } },
    { new: true },
  );
}

async function markSuccess(id) {
  return Webhook.findOneAndUpdate(
    { id: Number(id) },
    { $set: { status: Webhook.STATUS.SUCCESS, processed_at: new Date(), last_error: null, next_attempt_at: null } },
    { new: true },
  );
}

async function markFailed(id, error, { nextAttemptAt = null } = {}) {
  return Webhook.findOneAndUpdate(
    { id: Number(id) },
    {
      $set: {
        status: Webhook.STATUS.FAILED,
        last_error: String(error || 'Unknown error').slice(0, 2000),
        next_attempt_at: nextAttemptAt,
      },
    },
    { new: true },
  );
}

// Rows left PROCESSING past the timeout window means the process crashed or hung mid-attempt.
// Reset them to FAILED (with next_attempt_at in the past) so the retry sweep picks them back up.
async function findStaleProcessing(cutoff, limit = 50) {
  return Webhook.find({ status: Webhook.STATUS.PROCESSING, last_attempt_at: { $lte: cutoff } }).limit(limit);
}

async function resetStaleToFailed(id) {
  return Webhook.findOneAndUpdate(
    { id: Number(id), status: Webhook.STATUS.PROCESSING },
    { $set: { status: Webhook.STATUS.FAILED, last_error: 'Processing timed out', next_attempt_at: new Date() } },
    { new: true },
  );
}

async function findRetryable(now, limit = 50) {
  return Webhook.find({
    status: Webhook.STATUS.FAILED,
    next_attempt_at: { $lte: now },
    $expr: { $lt: ['$attempts', '$max_attempts'] },
  }).limit(limit);
}

async function list(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Webhook.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Webhook.countDocuments(filter),
  ]);
  return { data, total };
}

module.exports = {
  create,
  findById,
  findByProviderAndExternalId,
  claimForProcessing,
  markSuccess,
  markFailed,
  findStaleProcessing,
  resetStaleToFailed,
  findRetryable,
  list,
};
