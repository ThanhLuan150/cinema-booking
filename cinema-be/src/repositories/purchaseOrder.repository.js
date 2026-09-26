const PurchaseOrder = require('../models/PurchaseOrder');
const inventoryRepository = require('./inventory.repository');
const nextId = require('../utils/nextId');
const { runInTransaction } = require('../utils/withTransaction');
const { REALTIME_ACTION } = require('../utils/realtimeEvents');

const { STATUS } = PurchaseOrder;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Raised inside `receive` to abort the receipt (rolling back the transaction, or triggering the
// compensation when there is none) and reported to the caller as a normal outcome.
class ReceiptAbort extends Error {
  constructor(code, inventoryId) {
    super(code);
    this.code = code;
    this.inventoryId = inventoryId;
  }
}

async function findById(id) {
  return PurchaseOrder.findOne({ id: Number(id) });
}

async function findBranchIdById(id) {
  const order = await PurchaseOrder.findOne({ id: Number(id) }, { branch_id: 1 });
  return order ? order.branch_id : null;
}

function buildListFilter({ branchId, branchIds, status, supplierId, search } = {}) {
  const filter = {};
  if (branchId !== undefined) filter.branch_id = Number(branchId);
  else if (branchIds) filter.branch_id = { $in: branchIds };
  if (status) filter.status = status;
  if (supplierId !== undefined) filter.supplier_id = Number(supplierId);
  if (search) filter.code = new RegExp(escapeRegex(search), 'i');
  return filter;
}

async function list({ skip = 0, limit = 20, ...criteria } = {}) {
  const filter = buildListFilter(criteria);
  const [data, total] = await Promise.all([
    PurchaseOrder.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    PurchaseOrder.countDocuments(filter),
  ]);
  return { data, total };
}

async function create({ supplierId, branchId, orderDate, expectedDate, note, items, totalAmount, createdBy }) {
  const id = await nextId('purchaseOrder');
  return PurchaseOrder.create({
    id,
    code: PurchaseOrder.codeFor(id),
    supplier_id: supplierId,
    branch_id: branchId,
    order_date: orderDate,
    expected_date: expectedDate,
    status: STATUS.DRAFT,
    total_amount: totalAmount,
    items,
    note,
    created_by: createdBy,
  });
}

// Every status change below is ONE conditional findOneAndUpdate with the expected current status in
// the filter, so of two racing requests (double-click, receive vs cancel) exactly one matches and
// the other gets null — the caller answers 409 instead of applying a transition twice.

async function updateDraft(id, updates) {
  return PurchaseOrder.findOneAndUpdate(
    { id: Number(id), status: STATUS.DRAFT },
    { $set: updates },
    { returnDocument: 'after' },
  );
}

async function confirm(id, { by = null } = {}) {
  return PurchaseOrder.findOneAndUpdate(
    { id: Number(id), status: STATUS.DRAFT },
    { $set: { status: STATUS.ORDERED, ordered_at: new Date(), ordered_by: by } },
    { returnDocument: 'after' },
  );
}

async function cancel(id, { by = null, reason = '' } = {}) {
  return PurchaseOrder.findOneAndUpdate(
    { id: Number(id), status: { $in: PurchaseOrder.OPEN_STATUSES } },
    { $set: { status: STATUS.CANCELLED, cancelled_at: new Date(), cancelled_by: by, cancel_reason: reason } },
    { returnDocument: 'after' },
  );
}

// Only a DRAFT is ever deleted; anything that reached ORDERED is history and is cancelled instead.
async function removeDraft(id) {
  const result = await PurchaseOrder.deleteOne({ id: Number(id), status: STATUS.DRAFT });
  return result.deletedCount > 0;
}

async function existsForSupplier(supplierId) {
  return Boolean(await PurchaseOrder.exists({ supplier_id: Number(supplierId) }));
}

// An Inventory record that a DRAFT/ORDERED order still expects to receive into must not vanish.
async function existsOpenForInventory(inventoryId) {
  return Boolean(
    await PurchaseOrder.exists({ 'items.inventory_id': Number(inventoryId), status: { $in: PurchaseOrder.OPEN_STATUSES } }),
  );
}

// Fallback compensation when there is no transaction to roll the receipt back: take the lines
// already added back out, withdraw their ledger rows, and put the order back to ORDERED so it can
// be received again.
async function compensateReceipt(order, applied) {
  await inventoryRepository.undoPurchaseLines(applied);
  await PurchaseOrder.updateOne(
    { id: order.id, status: STATUS.RECEIVED },
    { $set: { status: STATUS.ORDERED, received_at: null, received_by: null } },
  );
}

// THE one place stock arrives from a supplier. ORDERED -> RECEIVED and every line's increment
// (with its IMPORT ledger row) are ONE unit:
//
//   • On a replica set / Atlas, all of it runs in a single MongoDB transaction: any failure rolls
//     back the status flip, every stock increment and every ledger row together.
//   • On a standalone mongod (local dev, in-memory tests) there are no transactions, so the same
//     steps run as: guarded status flip first (the once-only gate — a second receive or a cancel
//     finds the order no longer ORDERED), then per-line increments each claimed under a unique
//     ledger key, and on any failure `compensateReceipt` undoes what landed. A hard process crash
//     between steps cannot be compensated there; that is the trade-off of not having transactions.
//
// Nothing is broadcast until the receipt has committed.
//
// Resolves to one of:
//   { order, movements }                  received
//   { notReceivable: true, order }        not ORDERED (already received / cancelled / still a draft)
//   { missingInventory: <inventory_id> }  a line's product no longer exists in the branch
async function receive(id, { performedBy = null } = {}) {
  let outcome;
  try {
    outcome = await runInTransaction(async (session) => {
      const order = await PurchaseOrder.findOneAndUpdate(
        { id: Number(id), status: STATUS.ORDERED },
        { $set: { status: STATUS.RECEIVED, received_at: new Date(), received_by: performedBy } },
        { returnDocument: 'after', session },
      );
      if (!order) return { notReceivable: true };

      const applied = [];
      try {
        for (const line of order.items) {
          const result = await inventoryRepository.receivePurchaseLine({ order, line, performedBy, session });
          if (result.missing) throw new ReceiptAbort('INVENTORY_MISSING', line.inventory_id);
          if (result.skipped) {
            // Without a transaction a leftover ledger row means an earlier attempt already added
            // this line, so it is correctly not added twice. Inside one it cannot legitimately
            // happen, and continuing after a duplicate-key error would run on an aborted transaction.
            if (session) throw new ReceiptAbort('DUPLICATE_RECEIPT', line.inventory_id);
            continue;
          }
          applied.push(result);
        }
      } catch (err) {
        if (!session) {
          if (err.partial) applied.push(err.partial);
          try {
            await compensateReceipt(order, applied);
          } catch (compensationError) {
            console.error('[purchaseOrder] receipt compensation failed', order.code, compensationError.message);
          }
        }
        throw err;
      }
      return { order, applied };
    });
  } catch (err) {
    if (err instanceof ReceiptAbort && err.code === 'INVENTORY_MISSING') return { missingInventory: err.inventoryId };
    throw err;
  }

  if (outcome.notReceivable) return { notReceivable: true, order: await findById(id) };

  const movements = outcome.applied.map(({ moved }) => ({
    inventoryId: moved.inventory.id,
    quantity: moved.applied,
    before: moved.before,
    after: moved.after,
  }));
  for (const { moved } of outcome.applied) {
    inventoryRepository.broadcastInventory(moved.inventory, REALTIME_ACTION.UPDATED, moved.previousStatus);
  }
  return { order: outcome.order, movements };
}

module.exports = {
  findById,
  findBranchIdById,
  list,
  create,
  updateDraft,
  confirm,
  cancel,
  removeDraft,
  existsForSupplier,
  existsOpenForInventory,
  receive,
  ReceiptAbort,
};
