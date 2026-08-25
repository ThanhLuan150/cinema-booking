const Payment = require('../models/Payment');
const nextId = require('../utils/nextId');

async function createPayment({
  code,
  bookingId,
  accountId,
  branchId = null,
  type,
  method,
  amount,
  status = Payment.STATUS.PENDING,
  idempotencyKey = null,
  createdBy = null,
  payUrl = null,
}) {
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotency_key: idempotencyKey });
    if (existing) return existing;
  }
  const existingByCode = await Payment.findOne({ code });
  if (existingByCode) return existingByCode;

  const doc = {
    id: await nextId('payment'),
    code,
    booking_id: bookingId,
    account_id: accountId,
    branch_id: branchId,
    type,
    method,
    amount,
    status,
    created_by: createdBy,
    pay_url: payUrl,
  };
  if (status === Payment.STATUS.PAID) doc.paid_at = new Date();
  if (idempotencyKey) doc.idempotency_key = idempotencyKey;

  try {
    return await Payment.create(doc);
  } catch (err) {
    if (err.code === 11000) {
      const existing = idempotencyKey
        ? await Payment.findOne({ idempotency_key: idempotencyKey })
        : await Payment.findOne({ code });
      if (existing) return existing;
    }
    throw err;
  }
}

async function findById(id) {
  return Payment.findOne({ id: Number(id) });
}

async function findByCode(code) {
  return Payment.findOne({ code });
}

async function findByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;
  return Payment.findOne({ idempotency_key: idempotencyKey });
}

async function setPayUrl(id, payUrl) {
  return Payment.updateOne({ id: Number(id) }, { $set: { pay_url: payUrl } });
}

async function markPaidIfPending(code, { gatewayTransactionId = null, rawResponse = null } = {}) {
  const update = { status: Payment.STATUS.PAID, paid_at: new Date() };
  if (gatewayTransactionId) update.gateway_transaction_id = gatewayTransactionId;
  if (rawResponse) update.raw_gateway_response = rawResponse;

  const updated = await Payment.findOneAndUpdate(
    { code, status: { $in: [Payment.STATUS.PENDING, Payment.STATUS.PROCESSING] } },
    { $set: update },
    { new: true },
  );
  if (updated) return { skip: false, payment: updated };
  const existing = await Payment.findOne({ code });
  return { skip: Boolean(existing), payment: existing };
}

async function markFailedIfPending(code, reason) {
  return Payment.findOneAndUpdate(
    { code, status: { $in: [Payment.STATUS.PENDING, Payment.STATUS.PROCESSING] } },
    { $set: { status: Payment.STATUS.FAILED, failed_at: new Date(), failure_reason: reason } },
    { new: true },
  );
}

async function markProcessing(code) {
  return Payment.findOneAndUpdate(
    { code, status: Payment.STATUS.PENDING },
    { $set: { status: Payment.STATUS.PROCESSING } },
    { new: true },
  );
}

async function requestRefund(id, reason = null) {
  return Payment.findOneAndUpdate(
    { id: Number(id), status: Payment.STATUS.PAID },
    { $set: { status: Payment.STATUS.REFUND_PENDING, refund_reason: reason, refund_requested_at: new Date() } },
    { new: true },
  );
}

async function completeRefund(id, refundedBy) {
  return Payment.findOneAndUpdate(
    { id: Number(id), status: Payment.STATUS.REFUND_PENDING },
    { $set: { status: Payment.STATUS.REFUNDED, refunded_at: new Date(), refunded_by: refundedBy } },
    { new: true },
  );
}

// Used by the dedicated Refund workflow (refund.controller.js) once a Refund reaches
// COMPLETED — transitions straight from PAID (the Refund entity itself now tracks the
// pending/approved states, so this payment never passes through REFUND_PENDING).
async function markRefunded(id, refundedBy) {
  return Payment.findOneAndUpdate(
    { id: Number(id), status: { $in: [Payment.STATUS.PAID, Payment.STATUS.REFUND_PENDING] } },
    { $set: { status: Payment.STATUS.REFUNDED, refunded_at: new Date(), refunded_by: refundedBy } },
    { new: true },
  );
}

async function listForAccount(accountId, { skip = 0, limit = 20 } = {}) {
  const filter = { account_id: Number(accountId) };
  const [data, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { data, total };
}

async function listAll(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { data, total };
}

module.exports = {
  createPayment,
  findById,
  findByCode,
  findByIdempotencyKey,
  setPayUrl,
  markPaidIfPending,
  markFailedIfPending,
  markProcessing,
  requestRefund,
  completeRefund,
  markRefunded,
  listForAccount,
  listAll,
};
