const ComboOrder = require('../models/ComboOrder');
const nextId = require('../utils/nextId');
const inventoryRepository = require('./inventory.repository');

async function createOrder({ branchId, accountId = null, bookingId = null, items, totalPrice, createdBy = null }) {
  return ComboOrder.create({
    id: await nextId('comboOrder'),
    code: `CO-${await nextId('comboOrderCode')}`,
    branch_id: branchId,
    account_id: accountId,
    booking_id: bookingId,
    items,
    total_price: totalPrice,
    status: ComboOrder.STATUS.PENDING,
    created_by: createdBy,
  });
}

async function findById(id) {
  return ComboOrder.findOne({ id: Number(id) });
}

async function findByCode(code) {
  return ComboOrder.findOne({ code });
}

async function listAll(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    ComboOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ComboOrder.countDocuments(filter),
  ]);
  return { data, total };
}

// The single choke point for PENDING -> PAID, reached both from a counter sale
// (comboOrder.controller.payOrder) and from a booking's linked combo order
// (booking.repository.createLinkedComboOrder) — hooking inventory deduction here, right after
// this atomic guarded update succeeds, means it runs exactly once per order no matter which
// caller triggered it or how many times payment confirmation is retried: a duplicate call always
// finds status no longer PENDING and returns null before reaching the deduction below.
async function markPaid(id, method) {
  const updated = await ComboOrder.findOneAndUpdate(
    { id: Number(id), status: ComboOrder.STATUS.PENDING },
    { $set: { status: ComboOrder.STATUS.PAID, paid_at: new Date(), payment_method: method } },
    { new: true },
  );
  if (updated) {
    try {
      await inventoryRepository.deductForComboOrder(updated);
    } catch (err) {
      // Never let warehouse bookkeeping block a payment that already succeeded.
      console.error(`Failed to deduct inventory for combo order ${updated.id}:`, err);
    }
  }
  return updated;
}

async function markPreparing(id) {
  return ComboOrder.findOneAndUpdate(
    { id: Number(id), status: ComboOrder.STATUS.PAID },
    { $set: { status: ComboOrder.STATUS.PREPARING, prepared_at: new Date() } },
    { new: true },
  );
}

async function markReady(id) {
  return ComboOrder.findOneAndUpdate(
    { id: Number(id), status: ComboOrder.STATUS.PREPARING },
    { $set: { status: ComboOrder.STATUS.READY, ready_at: new Date() } },
    { new: true },
  );
}

async function markDelivered(id) {
  return ComboOrder.findOneAndUpdate(
    { id: Number(id), status: ComboOrder.STATUS.READY },
    { $set: { status: ComboOrder.STATUS.DELIVERED, delivered_at: new Date() } },
    { new: true },
  );
}

async function cancel(id, reason) {
  return ComboOrder.findOneAndUpdate(
    { id: Number(id), status: { $in: ComboOrder.CANCELLABLE_STATUSES } },
    { $set: { status: ComboOrder.STATUS.CANCELLED, cancelled_at: new Date(), cancel_reason: reason || null } },
    { new: true },
  );
}

module.exports = {
  createOrder,
  findById,
  findByCode,
  listAll,
  markPaid,
  markPreparing,
  markReady,
  markDelivered,
  cancel,
};
