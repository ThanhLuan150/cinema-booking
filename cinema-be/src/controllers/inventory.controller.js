const inventoryRepository = require('../repositories/inventory.repository');
const Inventory = require('../models/Inventory');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const VALID_STATUSES = Object.values(Inventory.STATUS);

// BRANCH: caller must own the item's branch (Branch Admin). ALL: no restriction (Super Admin).
// There is no OWN/staff scope — inventory is warehouse management, Branch-Admin-only.
async function canAccessInventory(req, inventory) {
  if (req.permissionScope === 'ALL') return true;
  const ownedBranchIds = await inventoryRepository.findOwnedBranchIds(req.account.accountId);
  return ownedBranchIds.includes(inventory.branch_id);
}

// GET /api/inventory?branchId=&status=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const status = VALID_STATUSES.includes(req.query.status) ? req.query.status : undefined;
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

  if (req.permissionScope === 'ALL') {
    const { data, total } = await inventoryRepository.list({ branchId, status, skip, limit });
    return res.json(buildPaginatedResult({ data, total, page, limit }));
  }

  const ownedBranchIds = await inventoryRepository.findOwnedBranchIds(req.account.accountId);
  if (branchId !== undefined && !ownedBranchIds.includes(branchId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const { data, total } = await inventoryRepository.list({
    branchId,
    branchIds: branchId === undefined ? ownedBranchIds : undefined,
    status,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/inventory/alerts?branchId= -> Cảnh báo sắp hết hàng
async function listAlerts(req, res) {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

  if (req.permissionScope === 'ALL') {
    return res.json(await inventoryRepository.listLowStock({ branchId }));
  }

  const ownedBranchIds = await inventoryRepository.findOwnedBranchIds(req.account.accountId);
  if (branchId !== undefined && !ownedBranchIds.includes(branchId)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(
    await inventoryRepository.listLowStock({
      branchId,
      branchIds: branchId === undefined ? ownedBranchIds : undefined,
    }),
  );
}

// GET /api/inventory/:id
async function getById(req, res) {
  const inventory = await inventoryRepository.findById(req.params.id);
  if (!inventory) return res.status(404).json({ message: 'Inventory item not found' });
  if (!(await canAccessInventory(req, inventory))) return res.status(403).json({ message: 'Forbidden' });
  res.json(inventory);
}

// GET /api/inventory/:id/history?page=&limit= -> Lịch sử kho
async function getHistory(req, res) {
  const inventory = await inventoryRepository.findById(req.params.id);
  if (!inventory) return res.status(404).json({ message: 'Inventory item not found' });
  if (!(await canAccessInventory(req, inventory))) return res.status(403).json({ message: 'Forbidden' });

  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await inventoryRepository.listTransactions(inventory.id, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/inventory { branch_id, item, combo_id?, quantity?, minimum_quantity?, unit }
async function create(req, res) {
  const { item, combo_id, quantity, minimum_quantity, unit } = req.body;
  if (!item || !unit) return res.status(400).json({ message: 'item and unit are required' });

  const qty = quantity === undefined ? 0 : Number(quantity);
  const minQty = minimum_quantity === undefined ? 0 : Number(minimum_quantity);
  if (Number.isNaN(qty) || qty < 0 || Number.isNaN(minQty) || minQty < 0) {
    return res.status(400).json({ message: 'quantity and minimum_quantity must not be negative' });
  }

  const inventory = await inventoryRepository.create({
    branchId: req.branchId,
    comboId: combo_id ? Number(combo_id) : null,
    item,
    quantity: qty,
    minimumQuantity: minQty,
    unit,
  });
  res.status(201).json(inventory);
}

// PUT /api/inventory/:id { item?, combo_id?, minimum_quantity?, unit? } — quantity is never
// edited directly; use the receive/adjust/deduct actions so every change leaves a history entry.
async function update(req, res) {
  const fields = ['item', 'combo_id', 'minimum_quantity', 'unit'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates[field] = field === 'minimum_quantity' ? Number(req.body[field]) : req.body[field];
    }
  }
  const inventory = await inventoryRepository.updateFields(req.params.id, updates);
  if (!inventory) return res.status(404).json({ message: 'Inventory item not found' });
  res.json(inventory);
}

// DELETE /api/inventory/:id
async function remove(req, res) {
  await inventoryRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

// POST /api/inventory/:id/receive { quantity, reason? } -> Nhập kho
async function receive(req, res) {
  const quantity = Number(req.body.quantity);
  if (!quantity || quantity <= 0) return res.status(400).json({ message: 'quantity must be a positive number' });

  const updated = await inventoryRepository.receiveStock(req.params.id, {
    quantity,
    reason: req.body.reason,
    performedBy: req.account.accountId,
  });
  if (!updated) return res.status(404).json({ message: 'Inventory item not found' });
  res.json(updated);
}

// POST /api/inventory/:id/adjust { quantity, reason? } -> Điều chỉnh kho (sets the absolute
// counted quantity, e.g. after a physical stocktake)
async function adjust(req, res) {
  const quantity = Number(req.body.quantity);
  if (req.body.quantity === undefined || Number.isNaN(quantity) || quantity < 0) {
    return res.status(400).json({ message: 'quantity must be a non-negative number' });
  }

  const updated = await inventoryRepository.adjustStock(req.params.id, {
    quantity,
    reason: req.body.reason,
    performedBy: req.account.accountId,
  });
  if (!updated) return res.status(404).json({ message: 'Inventory item not found' });
  res.json(updated);
}

// POST /api/inventory/:id/deduct { quantity, reason? } -> Trừ kho (manual removal, e.g. spoilage)
async function deduct(req, res) {
  const quantity = Number(req.body.quantity);
  if (!quantity || quantity <= 0) return res.status(400).json({ message: 'quantity must be a positive number' });

  const updated = await inventoryRepository.deductStock(req.params.id, {
    quantity,
    reason: req.body.reason,
    performedBy: req.account.accountId,
  });
  if (!updated) return res.status(404).json({ message: 'Inventory item not found' });
  if (updated.insufficientStock) {
    return res.status(400).json({ message: 'Insufficient stock', code: 'INSUFFICIENT_STOCK' });
  }
  res.json(updated);
}

module.exports = {
  canAccessInventory,
  list,
  listAlerts,
  getById,
  getHistory,
  create,
  update,
  remove,
  receive,
  adjust,
  deduct,
};
