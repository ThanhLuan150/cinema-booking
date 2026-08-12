const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const shiftRepository = require('../repositories/shift.repository');
const employeeRepository = require('../repositories/employee.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Employees don't hold shift.read, so /me nests a read-only shift summary directly onto each
// assignment — otherwise the FE would have no way to show anything but a bare shift_id.
function withShiftSummary(assignment, shift) {
  return {
    ...assignment.toJSON(),
    shift: shift ? { name: shift.name, start_time: shift.start_time, end_time: shift.end_time } : undefined,
  };
}

// Combines a YYYY-MM-DD date with an HH:mm time into a Date. `rollToNextDay` handles an
// overnight shift's end_time (e.g. "16:00" -> "00:00") landing on the following calendar day.
function combineDateAndTime(date, time, { rollToNextDay = false } = {}) {
  const combined = new Date(`${date}T${time}:00`);
  if (rollToNextDay) combined.setDate(combined.getDate() + 1);
  return combined;
}

// Shared employee/shift/branch validation for create and update. Returns { employee, shift }
// on success, or writes an error response and returns null.
async function validateAssignment(res, { employee_id, shift_id }) {
  const employee = await employeeRepository.findById(employee_id);
  if (!employee) {
    res.status(404).json({ message: 'Employee not found' });
    return null;
  }
  if (employee.status !== 1) {
    res.status(400).json({ message: 'Employee is not active', code: 'EMPLOYEE_NOT_ACTIVE' });
    return null;
  }

  const shift = await shiftRepository.findById(shift_id);
  if (!shift) {
    res.status(404).json({ message: 'Shift not found' });
    return null;
  }
  if (shift.status !== 'ACTIVE') {
    res.status(400).json({ message: 'Shift is not active', code: 'SHIFT_NOT_ACTIVE' });
    return null;
  }

  // Ticket requirement: an employee may only be assigned to a shift of their own branch — no
  // cross-branch assignment.
  if (shift.branch_id !== employee.branch_id) {
    res.status(400).json({ message: 'Employee and shift must belong to the same branch', code: 'BRANCH_MISMATCH' });
    return null;
  }

  return { employee, shift };
}

// GET /api/shiftAssignment?branchId=&employeeId=&date=&status= (shiftAssignment.read
// permission, owner-scoped) — management view for a Branch Admin / Super Admin.
async function list(req, res) {
  const filter = { branch_id: req.branchId };
  if (req.query.employeeId) filter.employee_id = Number(req.query.employeeId);
  if (req.query.date) filter.date = req.query.date;
  if (req.query.status) filter.status = req.query.status;

  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await shiftAssignmentRepository.findAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/shiftAssignment/me?from=&to=&status= (shiftAssignment.read permission, OWN scope)
// — an Employee's own work schedule. Not currently staffed anywhere -> an empty page.
async function listMine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const employee = await employeeRepository.findByAccountId(req.account.accountId);
  if (!employee) return res.json(buildPaginatedResult({ data: [], total: 0, page, limit }));

  const filter = { employee_id: employee.id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = req.query.from;
    if (req.query.to) filter.date.$lte = req.query.to;
  }

  const { data, total } = await shiftAssignmentRepository.findAll(filter, { skip, limit });

  const shiftIds = [...new Set(data.map((assignment) => assignment.shift_id))];
  const shifts = await shiftRepository.findByIds(shiftIds);
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
  const enriched = data.map((assignment) => withShiftSummary(assignment, shiftById.get(assignment.shift_id)));

  res.json(buildPaginatedResult({ data: enriched, total, page, limit }));
}

// POST /api/shiftAssignment { employee_id, shift_id, date, start_at, end_at }
// (shiftAssignment.create permission, owner-scoped to the employee's own branch)
async function create(req, res) {
  const { employee_id, shift_id, date } = req.body;
  if (!employee_id || !shift_id || !date) {
    return res.status(400).json({ message: 'employee_id, shift_id and date are required' });
  }
  if (!DATE_RE.test(date)) {
    return res.status(400).json({ message: 'date must be YYYY-MM-DD', code: 'INVALID_DATE_FORMAT' });
  }

  const validated = await validateAssignment(res, { employee_id, shift_id });
  if (!validated) return;
  const { employee, shift } = validated;

  const duplicate = await shiftAssignmentRepository.findActiveDuplicate({ employee_id, shift_id, date });
  if (duplicate) {
    return res.status(409).json({
      message: 'This employee is already assigned to this shift on this date',
      code: 'DUPLICATE_ASSIGNMENT',
    });
  }

  const rollToNextDay = shift.end_time <= shift.start_time;
  const start_at = req.body.start_at ? new Date(req.body.start_at) : combineDateAndTime(date, shift.start_time);
  const end_at = req.body.end_at
    ? new Date(req.body.end_at)
    : combineDateAndTime(date, shift.end_time, { rollToNextDay });

  if (Number.isNaN(start_at.getTime()) || Number.isNaN(end_at.getTime()) || end_at <= start_at) {
    return res.status(400).json({ message: 'start_at must be before end_at', code: 'INVALID_TIME_RANGE' });
  }

  const id = await nextId('shiftAssignment');
  const assignment = await shiftAssignmentRepository.create({
    id,
    employee_id: employee.id,
    shift_id: shift.id,
    branch_id: employee.branch_id,
    date,
    start_at,
    end_at,
    status: 'ACTIVE',
  });

  res.status(201).json(assignment);
}

// PUT /api/shiftAssignment/:id { shift_id, date, start_at, end_at, status }
// (shiftAssignment.update permission, owner-scoped) — employee_id is immutable; re-assigning
// to a different employee is a new assignment, not an edit of this one.
async function update(req, res) {
  const existing = await shiftAssignmentRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Shift assignment not found' });

  const updates = {};
  const shiftOrDateChanged = req.body.shift_id !== undefined || req.body.date !== undefined;
  const timingChanged = shiftOrDateChanged || req.body.start_at !== undefined || req.body.end_at !== undefined;

  if (timingChanged) {
    const shift_id = req.body.shift_id !== undefined ? req.body.shift_id : existing.shift_id;
    const date = req.body.date !== undefined ? req.body.date : existing.date;
    if (req.body.date !== undefined && !DATE_RE.test(date)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD', code: 'INVALID_DATE_FORMAT' });
    }

    const validated = await validateAssignment(res, { employee_id: existing.employee_id, shift_id });
    if (!validated) return;
    const { shift } = validated;

    if (shiftOrDateChanged && (Number(shift_id) !== existing.shift_id || date !== existing.date)) {
      const duplicate = await shiftAssignmentRepository.findActiveDuplicate({
        employee_id: existing.employee_id,
        shift_id,
        date,
        excludeId: existing.id,
      });
      if (duplicate) {
        return res.status(409).json({
          message: 'This employee is already assigned to this shift on this date',
          code: 'DUPLICATE_ASSIGNMENT',
        });
      }
    }

    const rollToNextDay = shift.end_time <= shift.start_time;
    const start_at = req.body.start_at ? new Date(req.body.start_at) : combineDateAndTime(date, shift.start_time);
    const end_at = req.body.end_at
      ? new Date(req.body.end_at)
      : combineDateAndTime(date, shift.end_time, { rollToNextDay });

    if (Number.isNaN(start_at.getTime()) || Number.isNaN(end_at.getTime()) || end_at <= start_at) {
      return res.status(400).json({ message: 'start_at must be before end_at', code: 'INVALID_TIME_RANGE' });
    }

    updates.shift_id = Number(shift_id);
    updates.date = date;
    updates.start_at = start_at;
    updates.end_at = end_at;
  }

  if (req.body.status !== undefined) {
    if (!['ACTIVE', 'CANCELLED'].includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    updates.status = req.body.status;
  }

  const assignment = await shiftAssignmentRepository.updateFields(existing.id, updates);
  res.json(assignment);
}

// DELETE /api/shiftAssignment/:id (shiftAssignment.delete permission, owner-scoped)
async function remove(req, res) {
  const existing = await shiftAssignmentRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Shift assignment not found' });

  await shiftAssignmentRepository.remove(existing.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, listMine, create, update, remove };
