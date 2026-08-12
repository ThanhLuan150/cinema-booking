const shiftRepository = require('../repositories/shift.repository');
const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// GET /api/shift?branchId=&page=&limit= (shift.read permission, owner-scoped — Branch Admin
// manages Shifts of their own branch)
async function list(req, res) {
  const filter = { branch_id: req.branchId };
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await shiftRepository.findAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/shift { branch_id, name, start_time, end_time } (shift.create permission, owner-scoped)
async function create(req, res) {
  const { name, start_time, end_time } = req.body;
  if (!name || !start_time || !end_time) {
    return res.status(400).json({ message: 'name, start_time and end_time are required' });
  }
  if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time)) {
    return res.status(400).json({ message: 'start_time and end_time must be HH:mm', code: 'INVALID_TIME_FORMAT' });
  }
  if (start_time === end_time) {
    return res.status(400).json({ message: 'start_time and end_time must differ', code: 'INVALID_TIME_RANGE' });
  }

  const id = await nextId('shift');
  const shift = await shiftRepository.create({
    id,
    branch_id: req.branchId,
    name,
    start_time,
    end_time,
    status: 'ACTIVE',
  });
  res.status(201).json(shift);
}

// PUT /api/shift/:id { name, start_time, end_time, status } (shift.update permission, owner-scoped)
async function update(req, res) {
  const existing = await shiftRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Shift not found' });

  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;

  if (req.body.start_time !== undefined || req.body.end_time !== undefined) {
    const nextStart = req.body.start_time !== undefined ? req.body.start_time : existing.start_time;
    const nextEnd = req.body.end_time !== undefined ? req.body.end_time : existing.end_time;
    if (!TIME_RE.test(nextStart) || !TIME_RE.test(nextEnd)) {
      return res.status(400).json({ message: 'start_time and end_time must be HH:mm', code: 'INVALID_TIME_FORMAT' });
    }
    if (nextStart === nextEnd) {
      return res.status(400).json({ message: 'start_time and end_time must differ', code: 'INVALID_TIME_RANGE' });
    }
    updates.start_time = nextStart;
    updates.end_time = nextEnd;
  }

  if (req.body.status !== undefined) {
    if (!['ACTIVE', 'INACTIVE'].includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    updates.status = req.body.status;
  }

  const shift = await shiftRepository.updateFields(existing.id, updates);
  res.json(shift);
}

// DELETE /api/shift/:id (shift.delete permission, owner-scoped) — refuses while a
// ShiftAssignment still references this shift, so an assignment never ends up dangling.
async function remove(req, res) {
  const existing = await shiftRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Shift not found' });

  const hasAssignments = await shiftAssignmentRepository.existsForShift(existing.id);
  if (hasAssignments) {
    return res
      .status(409)
      .json({ message: 'Shift has assignments and cannot be deleted', code: 'SHIFT_HAS_ASSIGNMENTS' });
  }

  await shiftRepository.remove(existing.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
