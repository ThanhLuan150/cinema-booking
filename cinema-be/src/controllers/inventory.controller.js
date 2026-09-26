const inventoryRepository = require('../repositories/inventory.repository');
const purchaseOrderRepository = require('../repositories/purchaseOrder.repository');
const recipeRepository = require('../repositories/recipe.repository');
const comboRepository = require('../repositories/combo.repository');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Combo = require('../models/Combo');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { REALTIME_ACTION } = require('../utils/realtimeEvents');

const VALID_STATUSES = Object.values(Inventory.STATUS);
const VALID_MOVEMENT_TYPES = Object.values(InventoryTransaction.TYPE);

const { broadcastInventory } = inventoryRepository;

// Upper bounds keep a typo (or a hostile 1e308) from poisoning stock arithmetic and reports.
const MAX_QUANTITY = 1e9;
const MAX_PRICE = 1e12;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

function badRequest(res, message, code = 'VALIDATION_ERROR', extra = {}) {
  return res.status(400).json({ message, code, ...extra });
}

// A finite number within [min, max]; anything else (NaN, Infinity, '', null, 'abc') is null.
function parseNumber(value, { min = 0, max = MAX_QUANTITY } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

// BRANCH: caller must own the item's branch (Branch Admin) or be actively staffed there (an
// Employee whose Position grants inventory.view — read-only; every write is owner-only).
// ALL: no restriction (Super Admin).
async function canAccessInventory(req, inventory) {
  if (req.permissionScope === 'ALL') return true;
  const ownedBranchIds = await inventoryRepository.findReadableBranchIds(req.account.accountId);
  return ownedBranchIds.includes(inventory.branch_id);
}

// Resolves the branch filter for a read: ALL scope may look anywhere; BRANCH scope is confined to
// the branches it can read, and asking for another branch's stock is refused outright.
async function resolveReadScope(req) {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  if (req.permissionScope === 'ALL') return { branchId };
  const ownedBranchIds = await inventoryRepository.findReadableBranchIds(req.account.accountId);
  if (branchId !== undefined && !ownedBranchIds.includes(branchId)) return { forbidden: true };
  return { branchId, branchIds: branchId === undefined ? ownedBranchIds : undefined };
}

// GET /api/inventory?branchId=&status=&category=&q=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = await resolveReadScope(req);
  if (scope.forbidden) return res.status(403).json({ message: 'Forbidden' });

  const { data, total } = await inventoryRepository.list({
    branchId: scope.branchId,
    branchIds: scope.branchIds,
    status: VALID_STATUSES.includes(req.query.status) ? req.query.status : undefined,
    category: req.query.category ? String(req.query.category) : undefined,
    search: req.query.q ? String(req.query.q).trim().slice(0, 100) : undefined,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/inventory/alerts?branchId= -> Cảnh báo sắp hết hàng
async function listAlerts(req, res) {
  const scope = await resolveReadScope(req);
  if (scope.forbidden) return res.status(403).json({ message: 'Forbidden' });
  res.json(await inventoryRepository.listLowStock({ branchId: scope.branchId, branchIds: scope.branchIds }));
}

// GET /api/inventory/categories?branchId= -> distinct categories in the caller's visible branches
async function listCategories(req, res) {
  const scope = await resolveReadScope(req);
  if (scope.forbidden) return res.status(403).json({ message: 'Forbidden' });
  const branchIds = scope.branchId !== undefined ? [scope.branchId] : scope.branchIds;
  res.json(await inventoryRepository.listCategories(branchIds));
}

// GET /api/inventory/:id
async function getById(req, res) {
  const inventory = await inventoryRepository.findById(req.params.id);
  if (!inventory) return res.status(404).json({ message: 'Inventory item not found' });
  if (!(await canAccessInventory(req, inventory))) return res.status(403).json({ message: 'Forbidden' });
  res.json(inventory);
}

// GET /api/inventory/:id/history?type=&page=&limit= -> Lịch sử kho
async function getHistory(req, res) {
  const inventory = await inventoryRepository.findById(req.params.id);
  if (!inventory) return res.status(404).json({ message: 'Inventory item not found' });
  if (!(await canAccessInventory(req, inventory))) return res.status(403).json({ message: 'Forbidden' });

  const { page, limit, skip } = parsePagination(req.query);
  const type = VALID_MOVEMENT_TYPES.includes(req.query.type) ? req.query.type : undefined;
  const { data, total } = await inventoryRepository.listTransactions(inventory.id, { skip, limit, type });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// Validates + normalises the catalogue fields shared by create and update. `partial` (update)
// only checks the fields that were sent. Returns { error } or { values } keyed by schema names.
function parseCatalogueFields(body, { partial }) {
  const values = {};
  const fail = (message, code = 'VALIDATION_ERROR') => ({ error: { message, code } });

  if (!partial || body.item !== undefined) {
    const item = typeof body.item === 'string' ? body.item.trim() : '';
    if (!item || item.length > 120) return fail('item is required (max 120 characters)');
    values.item = item;
  }
  if (!partial || body.unit !== undefined) {
    const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
    if (!unit || unit.length > 20) return fail('unit is required (max 20 characters)');
    values.unit = unit;
  }
  if (body.sku !== undefined) {
    const sku = body.sku === null ? '' : String(body.sku).trim();
    if (sku && !SKU_PATTERN.test(sku)) {
      return fail('sku may only contain letters, digits, dot, dash, underscore (max 40)', 'INVALID_SKU');
    }
    values.sku = sku ? sku.toUpperCase() : null;
  }
  if (body.category !== undefined) {
    const category = body.category === null ? '' : String(body.category).trim();
    if (category.length > 60) return fail('category must be at most 60 characters');
    values.category = category;
  }
  for (const field of ['cost_price', 'selling_price']) {
    if (body[field] === undefined) continue;
    const price = parseNumber(body[field], { max: MAX_PRICE });
    if (price === null) return fail(`${field} must be a non-negative number`);
    values[field] = price;
  }
  if (body.minimum_quantity !== undefined) {
    const minimum = parseNumber(body.minimum_quantity);
    if (minimum === null) return fail('minimum_quantity must be a non-negative number');
    values.minimum_quantity = minimum;
  }
  return { values };
}

// A linked Combo must exist, sit in the SAME branch as the stock record, and be a base FOOD /
// BEVERAGE item — a COMBO bundle is deducted through the components it contains, so a record
// "tracking" a bundle would never be hit by a sale.
async function validateComboLink(branchId, comboId) {
  const combo = await comboRepository.findById(comboId);
  if (!combo) return { status: 400, code: 'COMBO_NOT_FOUND', message: `Combo ${comboId} not found` };
  if (combo.cinema_id !== branchId) {
    return { status: 400, code: 'COMBO_BRANCH_MISMATCH', message: `Combo ${comboId} does not belong to this branch` };
  }
  if (combo.type === Combo.TYPE.COMBO) {
    return { status: 400, code: 'COMBO_NOT_STOCKABLE', message: 'Only FOOD or BEVERAGE items can be stock-tracked, not a COMBO bundle' };
  }
  // Ticket 47: a product made from a recipe draws on its ingredients; counting it directly as well
  // would deduct it twice.
  if (await recipeRepository.findByProductId(comboId)) {
    return { status: 409, code: 'PRODUCT_HAS_RECIPE', message: 'This product has a recipe; its stock comes from the recipe ingredients' };
  }
  return null;
}

// The unique indexes are the source of truth for "one name / SKU / tracked combo per branch";
// this turns their E11000 into a translatable 409 instead of a 500.
function respondIfDuplicate(err, res) {
  if (err?.code !== 11000) return false;
  const keys = Object.keys(err.keyPattern || {});
  if (keys.includes('sku')) {
    res.status(409).json({ message: 'This SKU is already used in this branch', code: 'DUPLICATE_SKU' });
  } else if (keys.includes('combo_id')) {
    res.status(409).json({ message: 'This combo item already has a stock record in this branch', code: 'COMBO_ALREADY_TRACKED' });
  } else {
    res.status(409).json({ message: 'An item with this name already exists in this branch', code: 'DUPLICATE_ITEM' });
  }
  return true;
}

// POST /api/inventory { branch_id, item, unit, sku?, category?, combo_id?, quantity?, minimum_quantity?,
//                       cost_price?, selling_price? }
async function create(req, res) {
  const parsed = parseCatalogueFields(req.body, { partial: false });
  if (parsed.error) return badRequest(res, parsed.error.message, parsed.error.code);

  const quantity = req.body.quantity === undefined ? 0 : parseNumber(req.body.quantity);
  if (quantity === null) return badRequest(res, 'quantity must be a non-negative number');
  const { values } = parsed;
  const minimumQuantity = values.minimum_quantity ?? 0;

  let comboId = null;
  if (req.body.combo_id !== undefined && req.body.combo_id !== null && req.body.combo_id !== '') {
    comboId = Number(req.body.combo_id);
    if (!Number.isInteger(comboId)) return badRequest(res, 'combo_id must be an integer');
    const linkError = await validateComboLink(req.branchId, comboId);
    if (linkError) return res.status(linkError.status).json({ message: linkError.message, code: linkError.code });
  }

  let inventory;
  try {
    inventory = await inventoryRepository.create({
      branchId: req.branchId,
      comboId,
      item: values.item,
      sku: values.sku ?? null,
      category: values.category ?? '',
      quantity,
      minimumQuantity,
      unit: values.unit,
      costPrice: values.cost_price ?? 0,
      sellingPrice: values.selling_price ?? 0,
    });
  } catch (err) {
    if (respondIfDuplicate(err, res)) return;
    throw err;
  }
  broadcastInventory(inventory, REALTIME_ACTION.CREATED);
  res.status(201).json(inventory);
}

// PUT /api/inventory/:id { item?, unit?, sku?, category?, combo_id?, minimum_quantity?, cost_price?,
//                          selling_price? } — quantity is never edited directly; use the
// import/return/adjust/waste actions so every change leaves a history entry.
async function update(req, res) {
  const parsed = parseCatalogueFields(req.body, { partial: true });
  if (parsed.error) return badRequest(res, parsed.error.message, parsed.error.code);
  const updates = { ...parsed.values };

  if (req.body.combo_id !== undefined) {
    if (req.body.combo_id === null || req.body.combo_id === '') {
      updates.combo_id = null;
    } else {
      const comboId = Number(req.body.combo_id);
      if (!Number.isInteger(comboId)) return badRequest(res, 'combo_id must be an integer');
      const linkError = await validateComboLink(req.branchId, comboId);
      if (linkError) return res.status(linkError.status).json({ message: linkError.message, code: linkError.code });
      updates.combo_id = comboId;
    }
  }

  // An ingredient's recipe quantities are written in its stock unit and it must stay raw stock, so
  // neither may change while a recipe uses it (Ticket 47).
  const existing = await inventoryRepository.findById(req.params.id);
  if (existing && (await recipeRepository.existsForInventory(existing.id))) {
    if (updates.combo_id !== undefined && updates.combo_id !== null) {
      return res.status(409).json({
        message: 'This item is an ingredient of a recipe and cannot be linked to a product',
        code: 'INGREDIENT_IN_RECIPE',
      });
    }
    if (updates.unit !== undefined && updates.unit !== existing.unit) {
      return res.status(409).json({
        message: 'The unit of an ingredient used in a recipe cannot be changed',
        code: 'INGREDIENT_UNIT_LOCKED',
      });
    }
  }

  let inventory;
  try {
    inventory = await inventoryRepository.updateFields(req.params.id, updates);
  } catch (err) {
    if (respondIfDuplicate(err, res)) return;
    throw err;
  }
  if (!inventory) return res.status(404).json({ message: 'Inventory item not found' });
  broadcastInventory(inventory, REALTIME_ACTION.UPDATED);
  res.json(inventory);
}

// DELETE /api/inventory/:id
async function remove(req, res) {
  const existing = await inventoryRepository.findById(req.params.id);
  // A DRAFT/ORDERED Purchase Order still expects to receive into this product (Ticket 46).
  if (existing && (await purchaseOrderRepository.existsOpenForInventory(existing.id))) {
    return res.status(409).json({
      message: 'This product is on an open purchase order. Cancel or receive the order first.',
      code: 'INVENTORY_IN_OPEN_PURCHASE_ORDER',
    });
  }
  // A recipe that lists this ingredient could no longer be made (Ticket 47).
  if (existing && (await recipeRepository.existsForInventory(existing.id))) {
    return res.status(409).json({
      message: 'This item is an ingredient of a recipe. Remove it from the recipe first.',
      code: 'INVENTORY_IN_RECIPE',
    });
  }
  await inventoryRepository.remove(req.params.id);
  broadcastInventory(existing, REALTIME_ACTION.DELETED);
  res.json({ message: 'Deleted' });
}

// Builds a handler for one stock action. `absolute` (adjust) accepts 0 — a counted-zero shelf —
// where the others need a strictly positive amount.
function stockAction(repositoryFn, { absolute = false } = {}) {
  return async function handleStockAction(req, res) {
    const quantity = parseNumber(req.body.quantity);
    if (quantity === null || (!absolute && quantity === 0)) {
      return badRequest(
        res,
        absolute ? 'quantity must be a non-negative number' : 'quantity must be a positive number',
      );
    }
    const reason = req.body.reason === undefined || req.body.reason === null ? '' : String(req.body.reason).trim();
    if (reason.length > 500) return badRequest(res, 'reason must be at most 500 characters');

    const updated = await repositoryFn(req.params.id, {
      quantity,
      reason,
      performedBy: req.account.accountId,
    });
    if (!updated) return res.status(404).json({ message: 'Inventory item not found' });
    if (updated.insufficientStock) {
      return res.status(409).json({
        message: `Insufficient stock: requested ${quantity}, available ${updated.available}`,
        code: 'INSUFFICIENT_STOCK',
        item: updated.item,
        requested: quantity,
        available: updated.available,
      });
    }
    res.json(updated);
  };
}

// POST /api/inventory/:id/import { quantity, reason? } -> Nhập kho (IMPORT)
const importStock = stockAction((...args) => inventoryRepository.importStock(...args));
// POST /api/inventory/:id/return { quantity, reason? } -> Trả hàng về kho (RETURN)
const returnStock = stockAction((...args) => inventoryRepository.returnStock(...args));
// POST /api/inventory/:id/adjust { quantity, reason? } -> Điều chỉnh kho (ADJUSTMENT): sets the
// absolute counted quantity, e.g. after a physical stocktake
const adjust = stockAction((...args) => inventoryRepository.adjustStock(...args), { absolute: true });
// POST /api/inventory/:id/waste { quantity, reason? } -> Hủy hàng (WASTE): spoilage/expiry write-off
const waste = stockAction((...args) => inventoryRepository.wasteStock(...args));

module.exports = {
  canAccessInventory,
  list,
  listAlerts,
  listCategories,
  getById,
  getHistory,
  create,
  update,
  remove,
  importStock,
  returnStock,
  adjust,
  waste,
};
