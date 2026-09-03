const Refund = require('../models/Refund');
const nextId = require('../utils/nextId');

async function createRefund({ bookingId, paymentId, accountId, branchId = null, amount, policyPercent, reason, requestedBy }) {
  return Refund.create({
    id: await nextId('refund'),
    booking_id: bookingId,
    payment_id: paymentId,
    account_id: accountId,
    branch_id: branchId,
    amount,
    policy_percent: policyPercent,
    reason: reason || null,
    status: Refund.STATUS.REQUESTED,
    requested_by: requestedBy,
    requested_at: new Date(),
  });
}

async function findById(id) {
  return Refund.findOne({ id: Number(id) });
}

async function findActiveByBookingId(bookingId) {
  return Refund.findOne({ booking_id: Number(bookingId), status: { $in: Refund.ACTIVE_STATUSES } });
}

async function approve(id, { decidedBy, decisionReason = null } = {}) {
  return Refund.findOneAndUpdate(
    { id: Number(id), status: Refund.STATUS.REQUESTED },
    { $set: { status: Refund.STATUS.APPROVED, decided_by: decidedBy, decided_at: new Date(), decision_reason: decisionReason } },
    { new: true },
  );
}

async function reject(id, { decidedBy, decisionReason }) {
  return Refund.findOneAndUpdate(
    { id: Number(id), status: Refund.STATUS.REQUESTED },
    { $set: { status: Refund.STATUS.REJECTED, decided_by: decidedBy, decided_at: new Date(), decision_reason: decisionReason } },
    { new: true },
  );
}

async function markProcessing(id, { processedBy }) {
  return Refund.findOneAndUpdate(
    { id: Number(id), status: Refund.STATUS.APPROVED },
    { $set: { status: Refund.STATUS.PROCESSING, processed_by: processedBy, processed_at: new Date() } },
    { new: true },
  );
}

async function complete(id, { shiftId = null } = {}) {
  return Refund.findOneAndUpdate(
    { id: Number(id), status: Refund.STATUS.PROCESSING },
    { $set: { status: Refund.STATUS.COMPLETED, completed_at: new Date(), shift_id: shiftId } },
    { new: true },
  );
}

async function fail(id, { failureReason }) {
  return Refund.findOneAndUpdate(
    { id: Number(id), status: Refund.STATUS.PROCESSING },
    { $set: { status: Refund.STATUS.FAILED, failed_at: new Date(), failure_reason: failureReason } },
    { new: true },
  );
}

async function listForAccount(accountId, { skip = 0, limit = 20 } = {}) {
  const filter = { account_id: Number(accountId) };
  const [data, total] = await Promise.all([
    Refund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Refund.countDocuments(filter),
  ]);
  return { data, total };
}

async function listAll(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Refund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Refund.countDocuments(filter),
  ]);
  return { data, total };
}

module.exports = {
  createRefund,
  findById,
  findActiveByBookingId,
  approve,
  reject,
  markProcessing,
  complete,
  fail,
  listForAccount,
  listAll,
};
