const purchaseOrderRepository = require('../repositories/purchaseOrder.repository');
const supplierRepository = require('../repositories/supplier.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const { parseLines, buildOrderItems } = require('../utils/purchaseOrderLines');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { emitBranchEvent } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

const { STATUS } = PurchaseOrder;
const VALID_STATUSES = Object.values(STATUS);

function fail(res, status, code, message, extra = {}) {
  return res.status(status).json({ message, code, ...extra });
}

// A Purchase Order's supplier travels with it as a small summary, so a Branch Admin (or a Position
// granted purchaseOrder.read) never needs supplier.read just to see who an order is with.
async function present(orders) {
  const list = Array.isArray(orders) ? orders : [orders];
  const suppliers = await supplierRepository.findByIds([...new Set(list.map((order) => order.supplier_id))]);
  const summaryById = new Map(
    suppliers.map((s) => [s.id, { id: s.id, name: s.name, code: s.code, status: s.status }]),
  );
  const shaped = list.map((order) => ({ ...order.toJSON(), supplier: summaryById.get(order.supplier_id) || null }));
  return Array.isArray(orders) ? shaped : shaped[0];
}

// Stock is per branch, so an order is announced to that branch's room (and Super Admin's).
function broadcastOrder(order, action) {
  emitBranchEvent(order.branch_id, REALTIME_EVENT.PURCHASE_ORDER_UPDATED, {
    scope: 'ORDER',
    action,
    id: order.id,
    code: order.code,
    status: order.status,
  });
}

async function auditOrder(req, order, action, extra = {}) {
  await recordAudit({
    req,
    action,
    entityType: ENTITY_TYPE.PURCHASE_ORDER,
    entityId: order.id,
    branchId: order.branch_id,
    metadata: { code: order.code, supplierId: order.supplier_id, totalAmount: order.total_amount, ...extra },
  });
}

// READ access: ALL scope anywhere; BRANCH scope only the branches the caller owns (Branch Admin) or
// is actively staffed at (an Employee whose Position grants purchaseOrder.read).
async function canAccessOrder(req, order) {
  if (req.permissionScope === 'ALL') return true;
  const branchIds = await inventoryRepository.findReadableBranchIds(req.account.accountId);
  return branchIds.includes(order.branch_id);
}

async function resolveReadScope(req) {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  if (req.permissionScope === 'ALL') return { branchId };
  const readable = await inventoryRepository.findReadableBranchIds(req.account.accountId);
  if (branchId !== undefined && !readable.includes(branchId)) return { forbidden: true };
  return { branchId, branchIds: branchId === undefined ? readable : undefined };
}

// Accepts a Date, an ISO string or 'YYYY-MM-DD'; anything else is null.
function parseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Whole-day comparison in UTC (the repo-wide convention for date-only values): an expected date on
// the same day as the order date is fine.
function dayOf(date) {
  return date.toISOString().slice(0, 10);
}

// Loads the products a set of parsed lines refers to and turns them into persisted items + total.
async function resolveItems(rawItems, branchId) {
  const parsed = parseLines(rawItems);
  if (parsed.error) return { error: { ...parsed.error, status: 400 } };
  const records = await inventoryRepository.findByIds(parsed.lines.map((line) => line.inventory_id));
  return buildOrderItems(parsed.lines, new Map(records.map((r) => [r.id, r])), branchId);
}

async function loadActiveSupplier(supplierId) {
  const supplier = await supplierRepository.findById(supplierId);
  if (!supplier) return { error: { status: 400, code: 'SUPPLIER_NOT_FOUND', message: `Supplier ${supplierId} not found` } };
  if (supplier.status !== Supplier.STATUS.ACTIVE) {
    return { error: { status: 400, code: 'SUPPLIER_INACTIVE', message: 'This supplier is inactive' } };
  }
  return { supplier };
}

// GET /api/purchase-orders?branchId=&status=&supplierId=&q=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = await resolveReadScope(req);
  if (scope.forbidden) return fail(res, 403, 'FORBIDDEN', 'Forbidden');

  const { data, total } = await purchaseOrderRepository.list({
    branchId: scope.branchId,
    branchIds: scope.branchIds,
    status: VALID_STATUSES.includes(req.query.status) ? req.query.status : undefined,
    supplierId: req.query.supplierId !== undefined && req.query.supplierId !== '' ? Number(req.query.supplierId) : undefined,
    search: req.query.q ? String(req.query.q).trim().slice(0, 50) : undefined,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data: await present(data), total, page, limit }));
}

// GET /api/purchase-orders/:id
async function getById(req, res) {
  const order = await purchaseOrderRepository.findById(req.params.id);
  if (!order) return fail(res, 404, 'NOT_FOUND', 'Purchase order not found');
  if (!(await canAccessOrder(req, order))) return fail(res, 403, 'FORBIDDEN', 'Forbidden');
  res.json(await present(order));
}

// Shared validation of the header fields of create/update. `existing` (update) supplies the values
// that were not re-sent, so the date-order rule is checked against the resulting pair.
function parseHeader(body, existing = null) {
  const values = {};

  if (body.order_date !== undefined || !existing) {
    const orderDate = body.order_date === undefined ? new Date() : parseDate(body.order_date);
    if (!orderDate) return { error: { code: 'VALIDATION_ERROR', message: 'order_date must be a valid date' } };
    values.order_date = orderDate;
  }
  if (body.expected_date !== undefined) {
    const expected = parseDate(body.expected_date);
    if (body.expected_date !== null && body.expected_date !== '' && !expected) {
      return { error: { code: 'VALIDATION_ERROR', message: 'expected_date must be a valid date' } };
    }
    values.expected_date = expected;
  }
  if (body.note !== undefined) {
    const note = body.note === null ? '' : String(body.note).trim();
    if (note.length > 500) return { error: { code: 'VALIDATION_ERROR', message: 'note must be at most 500 characters' } };
    values.note = note;
  }

  const orderDate = values.order_date || (existing && existing.order_date);
  const expectedDate = 'expected_date' in values ? values.expected_date : existing && existing.expected_date;
  if (orderDate && expectedDate && dayOf(expectedDate) < dayOf(orderDate)) {
    return { error: { code: 'EXPECTED_BEFORE_ORDER', message: 'expected_date cannot be before order_date' } };
  }
  return { values };
}

// POST /api/purchase-orders { branch_id, supplier_id, order_date?, expected_date?, note?, items? }
// (purchaseOrder.manage, owner-scoped). Always created as a DRAFT; total_amount is computed here.
async function create(req, res) {
  const header = parseHeader(req.body);
  if (header.error) return fail(res, 400, header.error.code, header.error.message);

  const supplierId = Number(req.body.supplier_id);
  if (!Number.isInteger(supplierId)) return fail(res, 400, 'VALIDATION_ERROR', 'supplier_id is required');
  const supplierResult = await loadActiveSupplier(supplierId);
  if (supplierResult.error) return fail(res, supplierResult.error.status, supplierResult.error.code, supplierResult.error.message);

  const resolved = await resolveItems(req.body.items === undefined ? [] : req.body.items, req.branchId);
  if (resolved.error) return fail(res, resolved.error.status || 400, resolved.error.code, resolved.error.message);

  const order = await purchaseOrderRepository.create({
    supplierId,
    branchId: req.branchId,
    orderDate: header.values.order_date,
    expectedDate: header.values.expected_date || null,
    note: header.values.note || '',
    items: resolved.items,
    totalAmount: resolved.total,
    createdBy: req.account.accountId,
  });
  await auditOrder(req, order, ACTION.PURCHASE_ORDER_CREATED, { lines: order.items.length });
  broadcastOrder(order, REALTIME_ACTION.CREATED);
  res.status(201).json(await present(order));
}

function notEditable(res, order) {
  return fail(res, 409, 'PURCHASE_ORDER_NOT_EDITABLE', `A ${order.status} purchase order can no longer be edited`, {
    status: order.status,
  });
}

// PUT /api/purchase-orders/:id { supplier_id?, order_date?, expected_date?, note?, items? }
// Only a DRAFT is editable; `items`, when sent, REPLACES the line list.
async function update(req, res) {
  const existing = await purchaseOrderRepository.findById(req.params.id);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Purchase order not found');
  if (existing.status !== STATUS.DRAFT) return notEditable(res, existing);

  const header = parseHeader(req.body, existing);
  if (header.error) return fail(res, 400, header.error.code, header.error.message);
  const updates = { ...header.values };

  if (req.body.supplier_id !== undefined) {
    const supplierId = Number(req.body.supplier_id);
    if (!Number.isInteger(supplierId)) return fail(res, 400, 'VALIDATION_ERROR', 'supplier_id must be an integer');
    if (supplierId !== existing.supplier_id) {
      const supplierResult = await loadActiveSupplier(supplierId);
      if (supplierResult.error) {
        return fail(res, supplierResult.error.status, supplierResult.error.code, supplierResult.error.message);
      }
    }
    updates.supplier_id = supplierId;
  }
  if (req.body.items !== undefined) {
    const resolved = await resolveItems(req.body.items, existing.branch_id);
    if (resolved.error) return fail(res, resolved.error.status || 400, resolved.error.code, resolved.error.message);
    updates.items = resolved.items;
    updates.total_amount = resolved.total;
  }

  const order = await purchaseOrderRepository.updateDraft(existing.id, updates);
  // Confirmed/cancelled by someone else between the read above and the write.
  if (!order) return notEditable(res, (await purchaseOrderRepository.findById(existing.id)) || existing);

  await auditOrder(req, order, ACTION.PURCHASE_ORDER_UPDATED, { changed: Object.keys(updates) });
  broadcastOrder(order, REALTIME_ACTION.UPDATED);
  res.json(await present(order));
}

// DELETE /api/purchase-orders/:id — DRAFT only; a confirmed order is cancelled, not deleted.
async function remove(req, res) {
  const existing = await purchaseOrderRepository.findById(req.params.id);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Purchase order not found');

  if (!(await purchaseOrderRepository.removeDraft(existing.id))) {
    return fail(res, 409, 'PURCHASE_ORDER_NOT_DELETABLE', 'Only a draft purchase order can be deleted; cancel it instead', {
      status: existing.status,
    });
  }
  await auditOrder(req, existing, ACTION.PURCHASE_ORDER_DELETED);
  broadcastOrder(existing, REALTIME_ACTION.DELETED);
  res.json({ message: 'Deleted' });
}

// POST /api/purchase-orders/:id/confirm — DRAFT -> ORDERED. Freezes the lines; touches no stock.
async function confirm(req, res) {
  const existing = await purchaseOrderRepository.findById(req.params.id);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Purchase order not found');
  if (existing.status !== STATUS.DRAFT) {
    return fail(res, 409, 'INVALID_STATUS', `Only a draft can be confirmed (this order is ${existing.status})`, {
      status: existing.status,
    });
  }
  if (existing.items.length === 0) return fail(res, 400, 'EMPTY_ORDER', 'Add at least one product before confirming');

  const supplierResult = await loadActiveSupplier(existing.supplier_id);
  if (supplierResult.error) return fail(res, supplierResult.error.status, supplierResult.error.code, supplierResult.error.message);

  // Every product must still exist in this branch — receipt is refused later otherwise.
  const records = await inventoryRepository.findByIds(existing.items.map((line) => line.inventory_id));
  const live = new Set(records.filter((r) => r.branch_id === existing.branch_id).map((r) => r.id));
  const gone = existing.items.find((line) => !live.has(line.inventory_id));
  if (gone) return fail(res, 400, 'INVENTORY_NOT_FOUND', `Product ${gone.inventory_id} no longer exists in this branch`);

  const order = await purchaseOrderRepository.confirm(existing.id, { by: req.account.accountId });
  if (!order) {
    const current = (await purchaseOrderRepository.findById(existing.id)) || existing;
    return fail(res, 409, 'INVALID_STATUS', `Only a draft can be confirmed (this order is ${current.status})`, {
      status: current.status,
    });
  }
  await auditOrder(req, order, ACTION.PURCHASE_ORDER_CONFIRMED);
  broadcastOrder(order, REALTIME_ACTION.UPDATED);
  res.json(await present(order));
}

// POST /api/purchase-orders/:id/cancel { reason? } — DRAFT/ORDERED -> CANCELLED. A RECEIVED order
// cannot be cancelled: its stock is already in; correct it with an inventory waste/adjustment.
async function cancel(req, res) {
  const existing = await purchaseOrderRepository.findById(req.params.id);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Purchase order not found');

  const reason = req.body && req.body.reason ? String(req.body.reason).trim() : '';
  if (reason.length > 500) return fail(res, 400, 'VALIDATION_ERROR', 'reason must be at most 500 characters');

  const order = await purchaseOrderRepository.cancel(existing.id, { by: req.account.accountId, reason });
  if (!order) {
    const current = (await purchaseOrderRepository.findById(existing.id)) || existing;
    if (current.status === STATUS.RECEIVED) {
      return fail(res, 409, 'PURCHASE_ORDER_ALREADY_RECEIVED', 'A received purchase order cannot be cancelled', {
        status: current.status,
      });
    }
    return fail(res, 409, 'PURCHASE_ORDER_ALREADY_CANCELLED', 'This purchase order is already cancelled', {
      status: current.status,
    });
  }
  await recordAudit({
    req,
    action: ACTION.PURCHASE_ORDER_CANCELLED,
    entityType: ENTITY_TYPE.PURCHASE_ORDER,
    entityId: order.id,
    branchId: order.branch_id,
    reason: reason || null,
    metadata: { code: order.code, previousStatus: existing.status },
  });
  broadcastOrder(order, REALTIME_ACTION.UPDATED);
  res.json(await present(order));
}

// POST /api/purchase-orders/:id/receive — ORDERED -> RECEIVED, adding every line to Inventory as
// one unit (see purchaseOrder.repository.receive). Guarded by its own purchaseOrder.receive
// permission: being able to manage orders does not by itself let anyone bring stock in.
async function receive(req, res) {
  const existing = await purchaseOrderRepository.findById(req.params.id);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Purchase order not found');

  const result = await purchaseOrderRepository.receive(existing.id, { performedBy: req.account.accountId });

  if (result.missingInventory !== undefined) {
    return fail(
      res,
      409,
      'INVENTORY_MISSING',
      `Product ${result.missingInventory} no longer exists in this branch; nothing was received`,
      { inventory_id: result.missingInventory },
    );
  }
  if (result.notReceivable) {
    const status = result.order ? result.order.status : existing.status;
    const byStatus = {
      [STATUS.DRAFT]: ['PURCHASE_ORDER_NOT_ORDERED', 'Confirm the purchase order before receiving it'],
      [STATUS.RECEIVED]: ['PURCHASE_ORDER_ALREADY_RECEIVED', 'This purchase order has already been received'],
      [STATUS.CANCELLED]: ['PURCHASE_ORDER_CANCELLED', 'A cancelled purchase order cannot be received'],
    };
    const [code, message] = byStatus[status] || ['INVALID_STATUS', 'This purchase order cannot be received'];
    return fail(res, 409, code, message, { status });
  }

  await auditOrder(req, result.order, ACTION.PURCHASE_ORDER_RECEIVED, {
    lines: result.movements.length,
    units: result.movements.reduce((sum, m) => sum + m.quantity, 0),
  });
  broadcastOrder(result.order, REALTIME_ACTION.UPDATED);
  res.json({ ...(await present(result.order)), movements: result.movements });
}

module.exports = { list, getById, create, update, remove, confirm, cancel, receive, canAccessOrder };
