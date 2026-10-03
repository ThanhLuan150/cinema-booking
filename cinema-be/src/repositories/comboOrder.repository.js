const ComboOrder = require('../models/ComboOrder');
const nextId = require('../utils/nextId');
const inventoryRepository = require('./inventory.repository');
const paymentRepository = require('./payment.repository');
const { emitBranchEvent, emitToAccount } = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');

// The concession counter (/ComboOrders) and the Kitchen Display both watch this: every new paid order
// and every status hop has to land on the branch's screens without a refresh. The customer who ordered
// also gets their own copy so "your order is ready" arrives the moment staff taps it. It lives here,
// not in a controller, because orders reach PAID through more than one door — the counter's /pay and
// every booking channel (web MoMo, box office, kiosk) via booking.repository.createLinkedComboOrder.
function broadcastOrder(order, action) {
  if (!order) return;
  const payload = { action, id: order.id, code: order.code ?? null, status: order.status };
  emitBranchEvent(order.branch_id, REALTIME_EVENT.COMBO_ORDER_UPDATED, payload);
  emitToAccount(order.account_id, REALTIME_EVENT.COMBO_ORDER_UPDATED, payload);
}

// channel / seatDelivery / expiresAt are only set by the in-seat flow (Ticket 49); every other caller
// leaves them null, so counter and booking orders are stored exactly as before.
async function createOrder({
  branchId,
  accountId = null,
  bookingId = null,
  items,
  totalPrice,
  createdBy = null,
  channel = null,
  seatDelivery = null,
  expiresAt = null,
}) {
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
    channel,
    seat_delivery: seatDelivery,
    expires_at: expiresAt,
  });
}

async function findById(id) {
  return ComboOrder.findOne({ id: Number(id) });
}

async function findByCode(code) {
  return ComboOrder.findOne({ code });
}

// A customer's own in-seat orders, newest first — optionally only those for one showtime (the
// in-seat page lists what they already ordered for the seat they are sitting in).
async function listInSeatForAccount(accountId, { scheduleId = null, limit = 50 } = {}) {
  const filter = { account_id: Number(accountId), channel: ComboOrder.CHANNEL.IN_SEAT };
  if (scheduleId !== null && scheduleId !== undefined) filter['seat_delivery.schedule_id'] = Number(scheduleId);
  return ComboOrder.find(filter).sort({ createdAt: -1, id: -1 }).limit(limit);
}

// In-seat orders still waiting for a payment whose window has passed (the hold sweep cancels them).
async function findExpiredInSeatPending(now = new Date()) {
  return ComboOrder.find({
    channel: ComboOrder.CHANNEL.IN_SEAT,
    status: ComboOrder.STATUS.PENDING,
    expires_at: { $ne: null, $lt: now },
  });
}

async function listAll(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    ComboOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ComboOrder.countDocuments(filter),
  ]);
  return { data, total };
}

// Kitchen Display queue for ONE branch: paid orders only (`paid_at` set — an unpaid or never-paid
// order is never returned, whatever `clauses` asks for) matching any of `clauses`, oldest payment
// first because the kitchen works first-in, first-out. One extra row is fetched so the caller can
// tell the board was truncated.
async function listForKitchen(branchId, clauses, { limit = 200 } = {}) {
  const rows = await ComboOrder.find({ branch_id: Number(branchId), paid_at: { $ne: null }, $or: clauses })
    .sort({ paid_at: 1, id: 1 })
    .limit(limit + 1);
  return { data: rows.slice(0, limit), truncated: rows.length > limit };
}

// How many paid orders each of `branchIds` has in each active kitchen status (PAID/PREPARING/READY),
// for the KDS branch picker. Branches with nothing waiting are simply absent from the result.
async function countActiveForKitchen(branchIds) {
  if (!branchIds.length) return [];
  return ComboOrder.aggregate([
    {
      $match: {
        branch_id: { $in: branchIds.map(Number) },
        paid_at: { $ne: null },
        status: { $in: [ComboOrder.STATUS.PAID, ComboOrder.STATUS.PREPARING, ComboOrder.STATUS.READY] },
      },
    },
    { $group: { _id: { branch_id: '$branch_id', status: '$status' }, count: { $sum: 1 } } },
  ]).then((rows) => rows.map((r) => ({ branch_id: r._id.branch_id, status: r._id.status, count: r.count })));
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

// `fromStatuses` narrows which statuses may be cancelled (default: every cancellable one). The Kitchen
// Display passes PAID/PREPARING only, so it can never cancel an order that is not on its screen.
async function cancel(id, reason, { performedBy = null, fromStatuses = ComboOrder.CANCELLABLE_STATUSES } = {}) {
  const allowed = fromStatuses.filter((status) => ComboOrder.CANCELLABLE_STATUSES.includes(status));
  const updated = await ComboOrder.findOneAndUpdate(
    { id: Number(id), status: { $in: allowed } },
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
    await flagInSeatRefund(updated, reason);
  }
  return updated;
}

// An in-seat order was paid online, up front, through its own Payment (code = order code). If it is
// then cancelled — from the KDS, the counter, wherever — the customer's money has to go back, so the
// payment is moved to REFUND_PENDING for staff to settle through the existing refund confirmation.
// Lives here, beside the restock, because cancellation has more than one door. A never-paid order
// (paid_at null) has nothing to refund, and requestRefund only ever moves a PAID payment, so calling
// this twice is harmless.
async function flagInSeatRefund(order, reason) {
  if (order.channel !== ComboOrder.CHANNEL.IN_SEAT || !order.paid_at) return null;
  try {
    const payment = await paymentRepository.findByCode(order.code);
    if (!payment) return null;
    return await paymentRepository.requestRefund(payment.id, `In-seat order ${order.code} cancelled${reason ? `: ${reason}` : ''}`);
  } catch (err) {
    console.error(`Failed to flag a refund for cancelled in-seat order ${order.id}:`, err);
    return null;
  }
}

module.exports = {
  broadcastOrder,
  createOrder,
  findById,
  findByCode,
  listInSeatForAccount,
  findExpiredInSeatPending,
  listAll,
  listForKitchen,
  countActiveForKitchen,
  markPaid,
  markPreparing,
  markReady,
  markDelivered,
  cancel,
};
