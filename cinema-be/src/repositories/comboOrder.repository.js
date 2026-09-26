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

// Pays a PENDING order. The PENDING -> PAID flip is the once-only gate; then the stock is taken.
//   default (concession sale): strict. If any tracked item is short the sale is REFUSED — the flip
//     is reverted (order stays PENDING, nothing deducted) and InsufficientStockError propagates.
//     Any other deduction failure also reverts and rethrows: fail closed, never "paid but stock
//     untouched".
//   allowShortfall (order created AFTER the customer already paid, e.g. combos bundled with a
//     ticket booking): never refuse — deduct what exists, floor at zero, swallow bookkeeping
//     errors so the paid booking is not blocked. The shortage is visible in the stock ledger.
async function markPaid(id, method, { shiftId = null, allowShortfall = false } = {}) {
  const updated = await ComboOrder.findOneAndUpdate(
    { id: Number(id), status: ComboOrder.STATUS.PENDING },
    { $set: { status: ComboOrder.STATUS.PAID, paid_at: new Date(), payment_method: method, shift_id: shiftId } },
    { new: true },
  );
  if (!updated) return updated;

  if (allowShortfall) {
    try {
      await inventoryRepository.deductForComboOrder(updated, { allowShortfall: true });
    } catch (err) {
      console.error(`Failed to deduct inventory for combo order ${updated.id}:`, err);
    }
    return updated;
  }

  try {
    await inventoryRepository.deductForComboOrder(updated);
  } catch (err) {
    await ComboOrder.findOneAndUpdate(
      { id: updated.id, status: ComboOrder.STATUS.PAID },
      { $set: { status: ComboOrder.STATUS.PENDING, paid_at: null, payment_method: null, shift_id: null } },
    );
    throw err;
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

async function cancel(id, reason, { performedBy = null } = {}) {
  const updated = await ComboOrder.findOneAndUpdate(
    { id: Number(id), status: { $in: ComboOrder.CANCELLABLE_STATUSES } },
    { $set: { status: ComboOrder.STATUS.CANCELLED, cancelled_at: new Date(), cancel_reason: reason || null } },
    { new: true },
  );
  if (updated) {
    try {
      // Whatever the sale took from stock goes back (a never-paid order took nothing: no-op).
      await inventoryRepository.restockForComboOrder(updated, { performedBy });
    } catch (err) {
      console.error(`Failed to restock inventory for cancelled combo order ${updated.id}:`, err);
    }
  }
  return updated;
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
