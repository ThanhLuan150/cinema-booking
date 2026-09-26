const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Combo = require('../models/Combo');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const nextId = require('../utils/nextId');
const InsufficientStockError = require('../utils/InsufficientStockError');
const { emitBranchEvent } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');

const { TYPE, REF } = InventoryTransaction;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Stock moves are the one thing a concession counter cannot afford to learn late: two cashiers
// selling from the same shelf both need the new count. Carried in one event (no separate alert)
// so the client decides how to react; `lowStock` + `previousStatus` let it warn only on the
// transition INTO low/out of stock instead of on every sale that happens while already low.
function broadcastInventory(inventory, action, previousStatus = null) {
  if (!inventory) return;
  emitBranchEvent(inventory.branch_id, REALTIME_EVENT.INVENTORY_UPDATED, {
    action,
    id: inventory.id,
    item: inventory.item,
    quantity: inventory.quantity,
    minimumQuantity: inventory.minimum_quantity,
    status: inventory.status,
    previousStatus,
    lowStock: Inventory.isLow(inventory.status) && !Inventory.isLow(previousStatus),
  });
}

async function findById(id) {
  return Inventory.findOne({ id: Number(id) });
}

async function findBranchIdById(id) {
  const inventory = await Inventory.findOne({ id: Number(id) });
  return inventory ? inventory.branch_id : null;
}

async function findOwnedBranchIds(accountId) {
  const branches = await Branch.find({ owner_id: Number(accountId) }, { id: 1 });
  return branches.map((b) => b.id);
}

// Branches whose stock an account may READ: the ones it owns (Branch Admin) plus the one it is
// actively staffed at (an Employee whose Position grants inventory.view). Writes stay owner-only
// — they are gated by inventory.manage + requireBranchOwnership, not by this.
async function findReadableBranchIds(accountId) {
  const owned = await findOwnedBranchIds(accountId);
  const staffed = await Employee.findOne({ user_id: Number(accountId), status: 1 });
  return staffed && !owned.includes(staffed.branch_id) ? [...owned, staffed.branch_id] : owned;
}

function buildListFilter({ branchId, branchIds, status, category, search } = {}) {
  const filter = {};
  if (branchId !== undefined) filter.branch_id = Number(branchId);
  else if (branchIds) filter.branch_id = { $in: branchIds };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ item: pattern }, { sku: pattern }];
  }
  return filter;
}

async function list({ skip = 0, limit = 20, ...criteria } = {}) {
  const filter = buildListFilter(criteria);
  const [data, total] = await Promise.all([
    Inventory.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Inventory.countDocuments(filter),
  ]);
  return { data, total };
}

// Cảnh báo sắp hết hàng: everything currently LOW_STOCK or OUT_OF_STOCK.
async function listLowStock({ branchId, branchIds } = {}) {
  const filter = { status: { $in: [Inventory.STATUS.LOW_STOCK, Inventory.STATUS.OUT_OF_STOCK] } };
  if (branchId !== undefined) filter.branch_id = Number(branchId);
  else if (branchIds) filter.branch_id = { $in: branchIds };
  return Inventory.find(filter).sort({ status: 1, id: -1 });
}

async function create({
  branchId,
  comboId = null,
  item,
  sku = null,
  category = '',
  quantity = 0,
  minimumQuantity = 0,
  unit,
  costPrice = 0,
  sellingPrice = 0,
}) {
  return Inventory.create({
    id: await nextId('inventory'),
    branch_id: branchId,
    combo_id: comboId,
    item,
    sku,
    category,
    quantity,
    minimum_quantity: minimumQuantity,
    unit,
    cost_price: costPrice,
    selling_price: sellingPrice,
    status: Inventory.computeStatus(quantity, minimumQuantity),
  });
}

// Edits master-data fields only — quantity is never set directly here so every quantity
// change goes through the stock-movement functions below and leaves a history entry. It is one
// pipeline update so `status` is recomputed against the quantity as it is at write time (a sale
// landing in between cannot leave a stale status). Values go through $literal: in a pipeline a
// string starting with `$` would otherwise be read as a field path.
async function updateFields(id, updates) {
  const literals = {};
  for (const [key, value] of Object.entries(updates)) literals[key] = { $literal: value };
  const before = await Inventory.findOneAndUpdate(
    { id: Number(id) },
    [{ $set: literals }, { $set: { status: Inventory.STATUS_EXPR } }],
    { returnDocument: 'before' },
  );
  if (!before) return null;
  return Inventory.findOne({ id: before.id });
}

async function remove(id) {
  return Inventory.deleteOne({ id: Number(id) });
}

async function logTransaction({
  inventoryId,
  branchId,
  type,
  quantityChange,
  quantityBefore,
  quantityAfter,
  reason,
  refType = null,
  refCode = null,
  performedBy = null,
}) {
  return InventoryTransaction.create({
    id: await nextId('inventoryTransaction'),
    inventory_id: inventoryId,
    branch_id: branchId,
    type,
    quantity_change: quantityChange,
    quantity_before: quantityBefore,
    quantity_after: quantityAfter,
    reason: reason || '',
    ref_type: refType,
    ref_code: refCode,
    performed_by: performedBy,
  });
}

// THE locking primitive. One stock movement = one atomic conditional findOneAndUpdate on a single
// document (MongoDB serialises writers on it), so there is no read-modify-write window for two
// concurrent sellers to both pass a "do we have enough?" check:
//   - a guarded decrement carries the check IN the filter (`quantity >= n`) — of N racing
//     buyers for the last unit, exactly one matches, the rest get `null` back;
//   - `quantity` and the derived `status` are written by the same pipeline stage list, so they
//     never disagree;
//   - `returnDocument: 'before'` hands back the exact pre-image the update was applied to, which
//     is what makes the ledger's quantity_before/after correct under contention (re-reading the
//     document afterwards would race with the next writer).
// No multi-document transaction is used (or needed): a movement touches exactly one document, and
// the ledger row that explains it is written right after it. (Those are two writes: a process crash
// between them would leave one movement without its history row — `quantity`, the source of truth,
// is never wrong.) Works on a standalone mongod, no replica set.
//
// mode: 'add' (delta > 0), 'subtract' (strict — fails when stock is short), 'clamp' (subtract but
//       floor at 0, for a sale that is already paid for), 'set' (absolute stocktake count).
// Returns null (no such record), { insufficient, available, item } (strict shortfall), or
// { inventory, previousStatus, before, after, applied } with `inventory` in its post-update state.
async function moveQuantity(id, { mode, amount }) {
  const filter = { id: Number(id) };
  let expression;
  if (mode === 'add') expression = { $add: ['$quantity', amount] };
  else if (mode === 'subtract') {
    filter.quantity = { $gte: amount };
    expression = { $subtract: ['$quantity', amount] };
  } else if (mode === 'clamp') expression = { $max: [0, { $subtract: ['$quantity', amount] }] };
  else expression = { $literal: amount };

  const before = await Inventory.findOneAndUpdate(
    filter,
    [{ $set: { quantity: expression } }, { $set: { status: Inventory.STATUS_EXPR } }],
    { returnDocument: 'before' },
  );
  if (!before) {
    const current = await Inventory.findOne({ id: Number(id) });
    return current ? { insufficient: true, available: current.quantity, item: current.item } : null;
  }

  let after;
  if (mode === 'add') after = before.quantity + amount;
  else if (mode === 'subtract') after = before.quantity - amount;
  else if (mode === 'clamp') after = Math.max(0, before.quantity - amount);
  else after = amount;

  const { quantity: quantityBefore, status: previousStatus } = before;
  before.quantity = after;
  before.status = Inventory.computeStatus(after, before.minimum_quantity);
  return { inventory: before, previousStatus, before: quantityBefore, after, applied: after - quantityBefore };
}

// Applies a movement atomically and writes its ledger row. Shortfall/not-found pass straight
// through (callers decide how to surface them); success is broadcast to the branch.
async function applyMovement(id, { mode, amount, type, reason, refType, refCode, performedBy }) {
  const moved = await moveQuantity(id, { mode, amount });
  if (!moved || moved.insufficient) return moved;
  const { inventory, before, after, applied, previousStatus } = moved;
  await logTransaction({
    inventoryId: inventory.id,
    branchId: inventory.branch_id,
    type,
    quantityChange: applied,
    quantityBefore: before,
    quantityAfter: after,
    reason,
    refType,
    refCode,
    performedBy,
  });
  broadcastInventory(inventory, REALTIME_ACTION.UPDATED, previousStatus);
  return moved;
}

// Nhập kho: stock received from a supplier — always increases quantity.
async function importStock(id, { quantity, reason, performedBy }) {
  const moved = await applyMovement(id, { mode: 'add', amount: quantity, type: TYPE.IMPORT, reason, performedBy });
  return moved ? moved.inventory : null;
}

// Hàng trả lại: stock put back by hand (goods returned to the shelf). Sale cancellations restock
// automatically through restockForComboOrder instead.
async function returnStock(id, { quantity, reason, performedBy }) {
  const moved = await applyMovement(id, { mode: 'add', amount: quantity, type: TYPE.RETURN, reason, performedBy });
  return moved ? moved.inventory : null;
}

// Điều chỉnh kho: sets the absolute counted quantity (stocktake correction). The delta is taken
// from the pre-image of the same atomic update, so a sale landing mid-stocktake cannot make the
// ledger record the wrong change.
async function adjustStock(id, { quantity, reason, performedBy }) {
  const moved = await applyMovement(id, { mode: 'set', amount: quantity, type: TYPE.ADJUSTMENT, reason, performedBy });
  return moved ? moved.inventory : null;
}

// Hủy hàng: staff-initiated write-off (spoiled, expired, damaged). Never pushes quantity negative:
// returns { insufficientStock: true, available } instead.
async function wasteStock(id, { quantity, reason, performedBy }) {
  const moved = await applyMovement(id, { mode: 'subtract', amount: quantity, type: TYPE.WASTE, reason, performedBy });
  if (!moved) return null;
  if (moved.insufficient) return { insufficientStock: true, available: moved.available, item: moved.item };
  return moved.inventory;
}

// Resolves a ComboOrder's line items down to base FOOD/BEVERAGE combo ids, expanding any
// bundled COMBO-type item into the components it contains (Combo.items), so e.g. one "Combo
// Bắp Nước" line deducts both the popcorn and the drink it bundles.
async function resolveDeductionLines(orderItems) {
  const comboIds = orderItems.map((entry) => entry.combo_id);
  const combos = await Combo.find({ id: { $in: comboIds } });
  const comboById = new Map(combos.map((c) => [c.id, c]));

  const lines = new Map(); // base combo_id -> total quantity to deduct
  const addLine = (id, qty) => lines.set(id, (lines.get(id) || 0) + qty);

  for (const orderItem of orderItems) {
    const combo = comboById.get(orderItem.combo_id);
    if (!combo) continue;
    if (combo.type === Combo.TYPE.COMBO) {
      for (const sub of combo.items) addLine(sub.item_id, sub.quantity * orderItem.quantity);
    } else {
      addLine(combo.id, orderItem.quantity);
    }
  }
  return lines;
}

// The tracked inventory record for each base combo of a sale, in THIS branch only — branch A's
// stock is never consulted or touched by a sale at branch B. Untracked combos (no record) are
// simply absent: they are not stock-limited.
async function loadTrackedLines(branchId, orderItems) {
  const lines = await resolveDeductionLines(orderItems);
  const records = await Inventory.find({ branch_id: Number(branchId), combo_id: { $in: [...lines.keys()] } });
  const recordByCombo = new Map(records.map((r) => [r.combo_id, r]));
  const tracked = [];
  for (const [comboId, quantity] of lines) {
    const inventory = recordByCombo.get(comboId);
    if (inventory) tracked.push({ comboId, quantity, inventory });
  }
  return tracked;
}

// Read-only availability check for a prospective sale. Advisory: it fails fast with a friendly
// error, while the strict atomic deduction at payment time is what actually forbids overselling.
async function findShortages(branchId, orderItems) {
  const tracked = await loadTrackedLines(branchId, orderItems);
  return tracked
    .filter(({ quantity, inventory }) => inventory.quantity < quantity)
    .map(({ comboId, quantity, inventory }) => ({
      combo_id: comboId,
      inventory_id: inventory.id,
      item: inventory.item,
      requested: quantity,
      available: inventory.quantity,
    }));
}

async function assertAvailable(branchId, orderItems) {
  const shortages = await findShortages(branchId, orderItems);
  if (shortages.length > 0) throw new InsufficientStockError(shortages);
}

// Same check for a flat list of combo ids where a repeated id means quantity > 1 — the shape the
// ticket-booking flows (MoMo / kiosk / counter / box office / gift card) carry.
async function assertAvailableForComboIds(branchId, comboIds) {
  const quantityById = new Map();
  for (const id of comboIds) quantityById.set(Number(id), (quantityById.get(Number(id)) || 0) + 1);
  const items = [...quantityById].map(([combo_id, quantity]) => ({ combo_id, quantity }));
  if (items.length === 0) return;
  await assertAvailable(branchId, items);
}

// Claims the ledger row for one (order, combo) movement. The unique (ref_type, ref_code) index
// makes this the idempotency gate: returns null when the movement was already claimed.
async function claimMovement({ inventory, type, refType, refCode, reason }) {
  try {
    return await InventoryTransaction.create({
      id: await nextId('inventoryTransaction'),
      inventory_id: inventory.id,
      branch_id: inventory.branch_id,
      type,
      quantity_change: 0,
      quantity_before: inventory.quantity,
      quantity_after: inventory.quantity,
      reason,
      ref_type: refType,
      ref_code: refCode,
    });
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

async function settleMovement(claim, moved) {
  await InventoryTransaction.updateOne(
    { id: claim.id },
    { $set: { quantity_change: moved.applied, quantity_before: moved.before, quantity_after: moved.after } },
  );
}

// Sale deduction for a ComboOrder — called from comboOrder.repository.markPaid, which flips
// PENDING -> PAID exactly once. Two independent idempotency layers: that guarded flip, and here a
// uniquely-keyed ledger row claimed per (order.code, base combo_id) BEFORE stock is touched, so a
// retried caller finds it already claimed and skips instead of subtracting twice.
//
//   strict (default)      all-or-nothing. Every line is decremented with a guarded atomic update;
//                         if any line is short, the lines already taken are put back, their claims
//                         are withdrawn, and InsufficientStockError is thrown — the sale is refused
//                         and stock is exactly as it was. This is the "cannot oversell" rule.
//   allowShortfall: true  for a sale that is ALREADY paid (ticket booking + combos): the customer
//                         holds the money receipt, so refusing is not an option. Each line is
//                         deducted down to zero at most — stock never goes negative — and the
//                         ledger row records the amount actually taken.
// Resolves to per-line results; a line with `skipped: true` was already processed.
async function deductForComboOrder(order, { allowShortfall = false } = {}) {
  const tracked = await loadTrackedLines(order.branch_id, order.items);
  const done = []; // lines applied in this call, kept so strict mode can undo them
  const results = [];

  for (const { comboId, quantity, inventory } of tracked) {
    const refCode = `${order.code}:${comboId}`;
    const claim = await claimMovement({
      inventory,
      type: TYPE.SALE,
      refType: REF.SALE,
      refCode,
      reason: `Combo order ${order.code}`,
    });
    if (!claim) {
      results.push({ inventoryId: inventory.id, comboId, skipped: true });
      continue;
    }

    const moved = await moveQuantity(inventory.id, { mode: allowShortfall ? 'clamp' : 'subtract', amount: quantity });
    if (!moved) {
      // The record was deleted between load and update: nothing left to deduct from.
      await InventoryTransaction.deleteOne({ id: claim.id });
      continue;
    }
    if (moved.insufficient) {
      await InventoryTransaction.deleteOne({ id: claim.id });
      await undoSaleLines(done);
      throw new InsufficientStockError(await findShortages(order.branch_id, order.items));
    }

    await settleMovement(claim, moved);
    done.push({ claim, moved });
    results.push({
      inventoryId: inventory.id,
      comboId,
      quantityDeducted: -moved.applied,
      shortfall: quantity + moved.applied, // > 0 only in allowShortfall mode when stock ran out
      skipped: false,
    });
  }

  for (const { moved } of done) broadcastInventory(moved.inventory, REALTIME_ACTION.UPDATED, moved.previousStatus);
  return results;
}

// Puts back lines a strict sale had already taken and withdraws their ledger rows, so a refused
// sale leaves neither a stock change nor a trace in the history.
async function undoSaleLines(done) {
  for (const { claim, moved } of done) {
    if (moved.applied < 0) await moveQuantity(moved.inventory.id, { mode: 'add', amount: -moved.applied });
    await InventoryTransaction.deleteOne({ id: claim.id });
  }
}

// Cancelling a paid ComboOrder puts its stock back. What is restocked is read from the sale's own
// ledger rows — exactly what was deducted (including a clamped, partial deduction), never
// recomputed from the order — and each return is claimed under its own unique key, so calling this
// twice (double cancel, retry) restocks once. A never-paid order has no sale rows: a no-op.
async function restockForComboOrder(order, { performedBy = null, reason } = {}) {
  const sales = await InventoryTransaction.find({
    type: TYPE.SALE,
    ref_type: REF.SALE,
    ref_code: { $regex: `^${escapeRegex(order.code)}:` },
    quantity_change: { $lt: 0 },
  });
  const results = [];

  for (const sale of sales) {
    const inventory = await Inventory.findOne({ id: sale.inventory_id });
    if (!inventory) continue;
    const claim = await claimMovement({
      inventory,
      type: TYPE.RETURN,
      refType: REF.RETURN,
      refCode: sale.ref_code,
      reason: reason || `Cancelled combo order ${order.code}`,
    });
    if (!claim) {
      results.push({ inventoryId: inventory.id, skipped: true });
      continue;
    }
    const moved = await moveQuantity(inventory.id, { mode: 'add', amount: -sale.quantity_change });
    if (!moved) {
      await InventoryTransaction.deleteOne({ id: claim.id });
      continue;
    }
    await InventoryTransaction.updateOne({ id: claim.id }, {
      $set: {
        quantity_change: moved.applied,
        quantity_before: moved.before,
        quantity_after: moved.after,
        performed_by: performedBy,
      },
    });
    broadcastInventory(moved.inventory, REALTIME_ACTION.UPDATED, moved.previousStatus);
    results.push({ inventoryId: inventory.id, quantityReturned: moved.applied, skipped: false });
  }
  return results;
}

async function listTransactions(inventoryId, { skip = 0, limit = 20, type } = {}) {
  const filter = { inventory_id: Number(inventoryId) };
  if (type) filter.type = type;
  const [data, total] = await Promise.all([
    InventoryTransaction.find(filter).sort({ createdAt: -1, id: -1 }).skip(skip).limit(limit),
    InventoryTransaction.countDocuments(filter),
  ]);
  return { data, total };
}

async function listCategories(branchIds) {
  const filter = branchIds ? { branch_id: { $in: branchIds } } : {};
  const categories = await Inventory.distinct('category', filter);
  return categories.filter(Boolean).sort();
}

module.exports = {
  broadcastInventory,
  findById,
  findBranchIdById,
  findOwnedBranchIds,
  findReadableBranchIds,
  list,
  listLowStock,
  listCategories,
  create,
  updateFields,
  remove,
  importStock,
  returnStock,
  adjustStock,
  wasteStock,
  resolveDeductionLines,
  findShortages,
  assertAvailable,
  assertAvailableForComboIds,
  deductForComboOrder,
  restockForComboOrder,
  listTransactions,
};
