const pricingRuleRepository = require('../repositories/pricingRule.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const PricingRule = require('../models/PricingRule');
const Room = require('../models/Room');

const EDITABLE_FIELDS = [
  'name',
  'price',
  'priority',
  'active',
  'effective_from',
  'effective_to',
  'branch_id',
  'room_type',
  'seat_type',
  'category_id',
  'day_type',
  'time_start',
  'time_end',
  'membership_level',
];

// A BRANCH-scope caller may only touch rules on a cinema they own; ALL scope always passes.
async function assertCinemaOwnership(req, branchId) {
  if (req.permissionScope === 'ALL') return true;
  if (!branchId) return false;
  const ownedIds = await pricingRuleRepository.findOwnedCinemaIds(req.account.accountId);
  return ownedIds.includes(Number(branchId));
}

// Shared shape validation for create/update. Returns an error message string, or null if valid.
// On a partial (update) validation, `current` is the existing document — a field the body
// doesn't touch falls back to its current value so cross-field checks (the time_start/
// time_end pairing, effective_from <= effective_to) are validated against what the rule will
// actually look like after the update, not just the fields this one request happens to send.
function validateFields(body, { partial = false, current = null } = {}) {
  if (!partial) {
    if (!body.name) return 'name is required';
    if (body.price === undefined || body.price === null) return 'price is required';
  }
  if (body.price !== undefined && body.price !== null && Number(body.price) < 0) {
    return 'price must not be negative';
  }
  if (body.room_type !== undefined && body.room_type !== null && !Room.TYPES.includes(body.room_type)) {
    return `room_type must be one of ${Room.TYPES.join(', ')}, or null`;
  }
  if (
    body.seat_type !== undefined &&
    body.seat_type !== null &&
    !PricingRule.SEAT_TYPES.includes(Number(body.seat_type))
  ) {
    return `seat_type must be one of ${PricingRule.SEAT_TYPES.join(', ')}, or null`;
  }
  if (body.day_type !== undefined && body.day_type !== null && !PricingRule.DAY_TYPES.includes(body.day_type)) {
    return `day_type must be one of ${PricingRule.DAY_TYPES.join(', ')}, or null`;
  }
  if (
    body.membership_level !== undefined &&
    body.membership_level !== null &&
    !PricingRule.MEMBERSHIP_LEVELS.includes(body.membership_level)
  ) {
    return `membership_level must be one of ${PricingRule.MEMBERSHIP_LEVELS.join(', ')}, or null`;
  }
  const fallback = (field) => {
    if (partial && current) return current[field];
    return partial ? undefined : null;
  };
  const timeStart = body.time_start !== undefined ? body.time_start : fallback('time_start');
  const timeEnd = body.time_end !== undefined ? body.time_end : fallback('time_end');
  if (!partial || timeStart !== undefined || timeEnd !== undefined) {
    const hasStart = !(timeStart === undefined || timeStart === null);
    const hasEnd = !(timeEnd === undefined || timeEnd === null);
    if (hasStart !== hasEnd) return 'time_start and time_end must be set together, or both left null';
    if (hasStart && timeStart > timeEnd) return 'time_start must not be after time_end';
  }

  const effectiveFrom = body.effective_from !== undefined ? body.effective_from : fallback('effective_from');
  const effectiveTo = body.effective_to !== undefined ? body.effective_to : fallback('effective_to');
  if (effectiveFrom !== undefined && effectiveTo !== undefined && effectiveFrom !== null && effectiveTo !== null && effectiveFrom > effectiveTo) {
    return 'effective_from must not be after effective_to';
  }
  return null;
}

// GET /api/pricingRule?branchId=&page=&limit() -> management view. BRANCH scope sees only
async function list(req, res) {
  const filter = {};
  if (req.permissionScope === 'BRANCH') {
    const ownedIds = await pricingRuleRepository.findOwnedCinemaIds(req.account.accountId);
    if (req.query.branchId) {
      filter.branch_id = ownedIds.includes(Number(req.query.branchId)) ? Number(req.query.branchId) : -1;
    } else {
      filter.branch_id = { $in: [...ownedIds, null] };
    }
  } else if (req.query.branchId) {
    filter.branch_id = Number(req.query.branchId);
  }
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await pricingRuleRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/pricingRule/:id
async function getById(req, res) {
  const rule = await pricingRuleRepository.findById(req.params.id);
  if (!rule) return res.status(404).json({ message: 'Pricing rule not found' });
  if (!(await assertCinemaOwnership(req, rule.branch_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(rule);
}

// POST /api/pricingRule { name, price, priority, branch_id, room_type, seat_type, category_id,
async function create(req, res) {
  const error = validateFields(req.body);
  if (error) return res.status(400).json({ message: error });

  const normalizedBranchId = req.body.branch_id === undefined || req.body.branch_id === null ? null : Number(req.body.branch_id);
  if (normalizedBranchId === null && req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Only admin can create a branch-wide (system) pricing rule' });
  }
  if (normalizedBranchId !== null && !(await assertCinemaOwnership(req, normalizedBranchId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = await nextId('pricingRule');
  const rule = await pricingRuleRepository.create({
    id,
    name: req.body.name,
    price: Number(req.body.price),
    priority: req.body.priority !== undefined ? Number(req.body.priority) : 0,
    active: req.body.active !== undefined ? Boolean(req.body.active) : true,
    effective_from: req.body.effective_from || null,
    effective_to: req.body.effective_to || null,
    branch_id: normalizedBranchId,
    room_type: req.body.room_type || null,
    seat_type: req.body.seat_type !== undefined && req.body.seat_type !== null ? Number(req.body.seat_type) : null,
    category_id: req.body.category_id !== undefined && req.body.category_id !== null ? Number(req.body.category_id) : null,
    day_type: req.body.day_type || null,
    time_start: req.body.time_start || null,
    time_end: req.body.time_end || null,
    membership_level: req.body.membership_level || null,
  });
  res.status(201).json(rule);
}

// PUT /api/pricingRule/:id (owner/admin, scoped to the rule's current branch)
async function update(req, res) {
  const rule = await pricingRuleRepository.findById(req.params.id);
  if (!rule) return res.status(404).json({ message: 'Pricing rule not found' });
  if (!(await assertCinemaOwnership(req, rule.branch_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const error = validateFields(req.body, { partial: true, current: rule });
  if (error) return res.status(400).json({ message: error });

  if (req.body.branch_id !== undefined) {
    const normalizedBranchId = req.body.branch_id === null ? null : Number(req.body.branch_id);
    if (normalizedBranchId === null && req.permissionScope !== 'ALL') {
      return res.status(403).json({ message: 'Only admin can make a pricing rule branch-wide (system)' });
    }
    if (normalizedBranchId !== null && !(await assertCinemaOwnership(req, normalizedBranchId))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] === undefined) continue;
    if (['seat_type', 'category_id', 'branch_id', 'priority', 'price'].includes(field)) {
      updates[field] = req.body[field] === null ? null : Number(req.body[field]);
    } else {
      updates[field] = req.body[field];
    }
  }
  const updated = await pricingRuleRepository.updateFields(rule.id, updates);
  res.json(updated);
}

// DELETE /api/pricingRule/:id (owner/admin, scoped)
async function remove(req, res) {
  const rule = await pricingRuleRepository.findById(req.params.id);
  if (!rule) return res.status(404).json({ message: 'Pricing rule not found' });
  if (!(await assertCinemaOwnership(req, rule.branch_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await pricingRuleRepository.remove(rule.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
