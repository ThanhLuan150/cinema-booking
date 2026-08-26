const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Combo = require('../models/Combo');
const Branch = require('../models/Branch');
const nextId = require('../utils/nextId');

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

async function list({ branchId, branchIds, status, skip = 0, limit = 20 } = {}) {
  const filter = {};
  if (branchId !== undefined) filter.branch_id = Number(branchId);
  else if (branchIds) filter.branch_id = { $in: branchIds };
  if (status) filter.status = status;
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

async function create({ branchId, comboId = null, item, quantity = 0, minimumQuantity = 0, unit }) {
  return Inventory.create({
    id: await nextId('inventory'),
    branch_id: branchId,
    combo_id: comboId,
    item,
    quantity,
    minimum_quantity: minimumQuantity,
    unit,
    status: Inventory.computeStatus(quantity, minimumQuantity),
  });
}

// Edits master-data fields only — quantity is never set directly here so every quantity
// change goes through receiveStock/adjustStock/deductStock and leaves a history entry.
async function updateFields(id, updates) {
  const inventory = await Inventory.findOne({ id: Number(id) });
  if (!inventory) return null;
  const next = { ...updates };
  const minimumQuantity = updates.minimum_quantity !== undefined ? updates.minimum_quantity : inventory.minimum_quantity;
  next.status = Inventory.computeStatus(inventory.quantity, minimumQuantity);
  return Inventory.findOneAndUpdate({ id: Number(id) }, { $set: next }, { new: true });
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

// Applies an atomic $inc to quantity, then reconciles the derived `status` field. The $inc
// itself is what makes concurrent quantity changes safe (no read-modify-write on quantity);
// status is best-effort/eventually-consistent against it, which is fine for a display field.
async function applyDelta(inventoryId, delta) {
  const updated = await Inventory.findOneAndUpdate(
    { id: Number(inventoryId) },
    { $inc: { quantity: delta } },
    { new: true },
  );
  const status = Inventory.computeStatus(updated.quantity, updated.minimum_quantity);
  if (status !== updated.status) {
    await Inventory.updateOne({ id: updated.id }, { $set: { status } });
    updated.status = status;
  }
  return updated;
}

// Nhập kho: always increases quantity.
async function receiveStock(id, { quantity, reason, performedBy }) {
  const inventory = await Inventory.findOne({ id: Number(id) });
  if (!inventory) return null;
  const before = inventory.quantity;
  const updated = await applyDelta(inventory.id, quantity);
  await logTransaction({
    inventoryId: updated.id,
    branchId: updated.branch_id,
    type: InventoryTransaction.TYPE.RECEIVE,
    quantityChange: quantity,
    quantityBefore: before,
    quantityAfter: updated.quantity,
    reason,
    performedBy,
  });
  return updated;
}

// Điều chỉnh kho: sets the absolute counted quantity (stocktake correction) — the delta can be
// positive or negative depending on whether the physical count is above or below the record.
async function adjustStock(id, { quantity, reason, performedBy }) {
  const inventory = await Inventory.findOne({ id: Number(id) });
  if (!inventory) return null;
  const before = inventory.quantity;
  const delta = quantity - before;
  const updated = await applyDelta(inventory.id, delta);
  await logTransaction({
    inventoryId: updated.id,
    branchId: updated.branch_id,
    type: InventoryTransaction.TYPE.ADJUST,
    quantityChange: delta,
    quantityBefore: before,
    quantityAfter: updated.quantity,
    reason,
    performedBy,
  });
  return updated;
}

// Trừ kho (manual): staff-initiated removal (e.g. spoilage/waste). Unlike the automatic
// combo-sale deduction below, this must never push quantity negative.
async function deductStock(id, { quantity, reason, performedBy }) {
  const inventory = await Inventory.findOne({ id: Number(id) });
  if (!inventory) return null;
  if (inventory.quantity < quantity) return { insufficientStock: true };
  const before = inventory.quantity;
  const updated = await applyDelta(inventory.id, -quantity);
  await logTransaction({
    inventoryId: updated.id,
    branchId: updated.branch_id,
    type: InventoryTransaction.TYPE.DEDUCT,
    quantityChange: -quantity,
    quantityBefore: before,
    quantityAfter: updated.quantity,
    reason,
    performedBy,
  });
  return updated;
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

// Automatic deduction when a ComboOrder is paid (called from comboOrder.repository.markPaid,
// which only ever transitions PENDING -> PAID once — see that file's guarded findOneAndUpdate).
// This function adds a second, independent layer of idempotency on top of that: for every
// (order.code, base combo_id) pair it first claims a uniquely-keyed InventoryTransaction row and
// only decrements quantity if that claim succeeds. A duplicate call for an order already
// processed here (e.g. a caller retried after a crash) finds the row already claimed and skips
// the decrement — it can never subtract stock twice for the same order line. Never throws for
// "nothing to deduct" cases (untracked item) — a payment that already succeeded must not be
// blocked by warehouse bookkeeping.
async function deductForComboOrder(order) {
  const lines = await resolveDeductionLines(order.items);
  const results = [];

  for (const [comboId, qty] of lines) {
    const inventory = await Inventory.findOne({ branch_id: order.branch_id, combo_id: comboId });
    if (!inventory) continue;

    const refType = 'COMBO_ORDER';
    const refCode = `${order.code}:${comboId}`;
    let claim;
    try {
      claim = await InventoryTransaction.create({
        id: await nextId('inventoryTransaction'),
        inventory_id: inventory.id,
        branch_id: inventory.branch_id,
        type: InventoryTransaction.TYPE.DEDUCT,
        quantity_change: 0,
        quantity_before: inventory.quantity,
        quantity_after: inventory.quantity,
        reason: `Combo order ${order.code}`,
        ref_type: refType,
        ref_code: refCode,
      });
    } catch (err) {
      if (err.code === 11000) {
        results.push({ inventoryId: inventory.id, comboId, skipped: true });
        continue;
      }
      throw err;
    }

    const updated = await applyDelta(inventory.id, -qty);
    await InventoryTransaction.updateOne(
      { id: claim.id },
      { $set: { quantity_change: -qty, quantity_before: inventory.quantity, quantity_after: updated.quantity } },
    );
    results.push({ inventoryId: inventory.id, comboId, quantityDeducted: qty, skipped: false });
  }

  return results;
}

async function listTransactions(inventoryId, { skip = 0, limit = 20 } = {}) {
  const filter = { inventory_id: Number(inventoryId) };
  const [data, total] = await Promise.all([
    InventoryTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    InventoryTransaction.countDocuments(filter),
  ]);
  return { data, total };
}

module.exports = {
  findById,
  findBranchIdById,
  findOwnedBranchIds,
  list,
  listLowStock,
  create,
  updateFields,
  remove,
  receiveStock,
  adjustStock,
  deductStock,
  resolveDeductionLines,
  deductForComboOrder,
  listTransactions,
};
