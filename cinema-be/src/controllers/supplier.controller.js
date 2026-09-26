const supplierRepository = require('../repositories/supplier.repository');
const purchaseOrderRepository = require('../repositories/purchaseOrder.repository');
const Supplier = require('../models/Supplier');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { emitToStaff } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{6,20}$/;
const VALID_STATUSES = Object.values(Supplier.STATUS);

// The supplier picker on every branch's Purchase Order form reads this catalogue.
function broadcastSupplier(action, supplier) {
  emitToStaff(REALTIME_EVENT.PURCHASE_ORDER_UPDATED, {
    scope: 'SUPPLIER',
    action,
    id: supplier.id,
    name: supplier.name,
    status: supplier.status,
  });
}

function duplicateCode(res) {
  return res.status(409).json({ message: 'A supplier with this code already exists', code: 'SUPPLIER_CODE_TAKEN' });
}

// GET /api/suppliers?status=&search=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (VALID_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { code: rx }];
  }
  const { data, total } = await supplierRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/suppliers/all?status= -> unpaginated, for pickers
async function all(req, res) {
  const filter = {};
  if (VALID_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  res.json(await supplierRepository.findAll(filter));
}

// GET /api/suppliers/:id
async function getById(req, res) {
  const supplier = await supplierRepository.findById(req.params.id);
  if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
  res.json(supplier);
}

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) errors.push('name is required (max 120 characters)');
  }
  if (!partial || body.code !== undefined) {
    const code = String(body.code || '').toUpperCase().trim();
    if (!CODE_RE.test(code)) errors.push('code must be 2-32 chars, letters/digits/_/- only');
  }
  if (body.email !== undefined && body.email !== '' && body.email !== null) {
    if (!EMAIL_RE.test(String(body.email).trim())) errors.push('email is not a valid email');
  }
  if (body.phone !== undefined && body.phone !== '' && body.phone !== null) {
    if (!PHONE_RE.test(String(body.phone).trim())) errors.push('phone is not a valid phone number');
  }
  if (body.address !== undefined && body.address !== null && String(body.address).trim().length > 300) {
    errors.push('address must be at most 300 characters');
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    errors.push('status must be ACTIVE or INACTIVE');
  }
  return errors;
}

function textOrEmpty(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

// POST /api/suppliers { name, code, email?, phone?, address?, status? }
async function create(req, res) {
  const errors = validatePayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join('; '), code: 'VALIDATION_ERROR' });

  const code = String(req.body.code).toUpperCase().trim();
  if (await supplierRepository.findByCode(code)) return duplicateCode(res);

  let supplier;
  try {
    supplier = await supplierRepository.create({
      id: await nextId('supplier'),
      name: String(req.body.name).trim(),
      code,
      email: textOrEmpty(req.body.email),
      phone: textOrEmpty(req.body.phone),
      address: textOrEmpty(req.body.address),
      status: req.body.status || Supplier.STATUS.ACTIVE,
    });
  } catch (err) {
    if (err.code === 11000) return duplicateCode(res);
    throw err;
  }
  await recordAudit({
    req,
    action: ACTION.SUPPLIER_CREATED,
    entityType: ENTITY_TYPE.SUPPLIER,
    entityId: supplier.id,
    metadata: { code: supplier.code, name: supplier.name },
  });
  broadcastSupplier(REALTIME_ACTION.CREATED, supplier);
  res.status(201).json(supplier);
}

// PUT /api/suppliers/:id
async function update(req, res) {
  const supplier = await supplierRepository.findById(req.params.id);
  if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

  const errors = validatePayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: errors.join('; '), code: 'VALIDATION_ERROR' });

  const updates = {};
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.code !== undefined) {
    const code = String(req.body.code).toUpperCase().trim();
    if (code !== supplier.code) {
      const clash = await supplierRepository.findByCode(code);
      if (clash && clash.id !== supplier.id) return duplicateCode(res);
    }
    updates.code = code;
  }
  if (req.body.email !== undefined) updates.email = textOrEmpty(req.body.email);
  if (req.body.phone !== undefined) updates.phone = textOrEmpty(req.body.phone);
  if (req.body.address !== undefined) updates.address = textOrEmpty(req.body.address);
  if (req.body.status !== undefined) updates.status = req.body.status;

  let updated;
  try {
    updated = await supplierRepository.updateFields(supplier.id, updates);
  } catch (err) {
    if (err.code === 11000) return duplicateCode(res);
    throw err;
  }
  await recordAudit({
    req,
    action: ACTION.SUPPLIER_UPDATED,
    entityType: ENTITY_TYPE.SUPPLIER,
    entityId: updated.id,
    metadata: { changed: Object.keys(updates), status: updated.status },
  });
  broadcastSupplier(REALTIME_ACTION.UPDATED, updated);
  res.json(updated);
}

// DELETE /api/suppliers/:id — refused once any Purchase Order refers to it (the order history
// must keep reading correctly); deactivate the supplier instead.
async function remove(req, res) {
  const supplier = await supplierRepository.findById(req.params.id);
  if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

  if (await purchaseOrderRepository.existsForSupplier(supplier.id)) {
    return res.status(409).json({
      message: 'This supplier has purchase orders and cannot be deleted. Deactivate it instead.',
      code: 'SUPPLIER_IN_USE',
    });
  }

  await supplierRepository.remove(supplier.id);
  await recordAudit({
    req,
    action: ACTION.SUPPLIER_DELETED,
    entityType: ENTITY_TYPE.SUPPLIER,
    entityId: supplier.id,
    metadata: { code: supplier.code, name: supplier.name },
  });
  broadcastSupplier(REALTIME_ACTION.DELETED, supplier);
  res.json({ message: 'Deleted' });
}

module.exports = { list, all, getById, create, update, remove };
