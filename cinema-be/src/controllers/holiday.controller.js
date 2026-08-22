const holidayRepository = require('../repositories/holiday.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function assertCinemaOwnership(req, branchId) {
  if (req.permissionScope === 'ALL') return true;
  if (!branchId) return false;
  const ownedIds = await holidayRepository.findOwnedCinemaIds(req.account.accountId);
  return ownedIds.includes(Number(branchId));
}

async function list(req, res) {
  const filter = {};
  if (req.permissionScope === 'BRANCH') {
    const ownedIds = await holidayRepository.findOwnedCinemaIds(req.account.accountId);
    if (req.query.branchId) {
      filter.branch_id = ownedIds.includes(Number(req.query.branchId)) ? Number(req.query.branchId) : -1;
    } else {
      filter.branch_id = { $in: [...ownedIds, null] };
    }
  } else if (req.query.branchId) {
    filter.branch_id = Number(req.query.branchId);
  }
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await holidayRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/pricingHoliday { date, name, branch_id } (branch_id null = admin only)
async function create(req, res) {
  const { date, name, branch_id } = req.body;
  if (!date || !DATE_RE.test(date)) return res.status(400).json({ message: 'date is required as YYYY-MM-DD' });

  const normalizedBranchId = branch_id === undefined || branch_id === null ? null : Number(branch_id);
  if (normalizedBranchId === null && req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Only admin can create a branch-wide (system) holiday' });
  }
  if (normalizedBranchId !== null && !(await assertCinemaOwnership(req, normalizedBranchId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = await nextId('holiday');
  try {
    const holiday = await holidayRepository.create({ id, date, name: name || '', branch_id: normalizedBranchId });
    res.status(201).json(holiday);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A holiday already exists for this date and branch', code: 'HOLIDAY_DUPLICATE' });
    }
    throw err;
  }
}

// PUT /api/pricingHoliday/:id (owner/admin, scoped)
async function update(req, res) {
  const holiday = await holidayRepository.findById(req.params.id);
  if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
  if (!(await assertCinemaOwnership(req, holiday.branch_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.body.date !== undefined && !DATE_RE.test(req.body.date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
  }

  const updates = {};
  for (const field of ['date', 'name']) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const updated = await holidayRepository.updateFields(holiday.id, updates);
  res.json(updated);
}

// DELETE /api/pricingHoliday/:id (owner/admin, scoped)
async function remove(req, res) {
  const holiday = await holidayRepository.findById(req.params.id);
  if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
  if (!(await assertCinemaOwnership(req, holiday.branch_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await holidayRepository.remove(holiday.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
