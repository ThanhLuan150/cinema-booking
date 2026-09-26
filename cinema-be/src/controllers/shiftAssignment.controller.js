const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const shiftRepository = require('../repositories/shift.repository');
const employeeRepository = require('../repositories/employee.repository');
const positionRepository = require('../repositories/position.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { emitBranchEvent, emitToAccount } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');

// `shift:updated` goes to the branch's roster board (and Super Admin); an actively staffed employee
// is a member of their branch's room, so it also refreshes their own schedule list.
//
// The employee it is about additionally gets `myShift:updated` on their account room so the FE can
// tell them "your shift changed". It is a separate event name precisely because they are also in
// the branch room — sending shift:updated down both channels would deliver it twice (see
// utils/socket.js on room overlap). The write has already succeeded by the time this runs, so a
// failure here is logged, never surfaced.
async function broadcastAssignment(assignment, action, knownEmployee) {
  if (!assignment) return;
  try {
    emitBranchEvent(assignment.branch_id, REALTIME_EVENT.SHIFT_UPDATED, {
      action,
      id: assignment.id,
      employeeId: assignment.employee_id,
      shiftId: assignment.shift_id,
      positionId: assignment.position_id,
      date: assignment.date,
      status: assignment.status,
    });

    const employee = knownEmployee || (await employeeRepository.findById(assignment.employee_id));
    if (employee) {
      emitToAccount(employee.user_id, REALTIME_EVENT.MY_SHIFT_UPDATED, {
        action,
        id: assignment.id,
        date: assignment.date,
        startAt: assignment.start_at,
        endAt: assignment.end_at,
        positionId: assignment.position_id,
        status: assignment.status,
        branchId: assignment.branch_id,
      });
    }
  } catch (err) {
    console.error('[shiftAssignment] failed to broadcast', assignment.id, err.message);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Employees don't hold shift.read, so /me nests a read-only shift summary directly onto each
// assignment — otherwise the FE would have no way to show anything but a bare shift_id.
function withShiftSummary(assignment, shift) {
  return {
    ...assignment,
    shift: shift ? { name: shift.name, start_time: shift.start_time, end_time: shift.end_time } : undefined,
  };
}

// Adds `position: { code, name }` for the role the shift is worked as. Employees lack
// position.read, so like the shift summary it has to come nested on the assignment.
async function withPositionSummaries(assignments) {
  const positions = await positionRepository.findAll();
  const positionById = new Map(positions.map((position) => [position.id, position]));
  return assignments.map((assignment) => {
    const position = positionById.get(assignment.position_id);
    return {
      ...assignment,
      position: position ? { code: position.code, name: position.name } : undefined,
    };
  });
}

// Combines a YYYY-MM-DD date with an HH:mm time into a Date. `rollToNextDay` handles an
// overnight shift's end_time (e.g. "16:00" -> "00:00") landing on the following calendar day.
function combineDateAndTime(date, time, { rollToNextDay = false } = {}) {
  const combined = new Date(`${date}T${time}:00`);
  if (rollToNextDay) combined.setDate(combined.getDate() + 1);
  return combined;
}

// Start/end for an assignment: explicit body values win, otherwise they come from the shift's
// template times on `date`. Returns null when the range is unparseable or not start < end.
function resolveTimes(shift, date, body) {
  const rollToNextDay = shift.end_time <= shift.start_time;
  const start_at = body.start_at ? new Date(body.start_at) : combineDateAndTime(date, shift.start_time);
  const end_at = body.end_at ? new Date(body.end_at) : combineDateAndTime(date, shift.end_time, { rollToNextDay });
  if (Number.isNaN(start_at.getTime()) || Number.isNaN(end_at.getTime()) || end_at <= start_at) return null;
  return { start_at, end_at };
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

// The Position an employee works a shift as. Omitted -> their own Position; supplied -> must be an
// existing, active Position (it may differ from their own, e.g. a cashier covering the ticket
// counter). Returns the id, or writes an error response and returns null.
async function resolvePositionId(res, positionId, employee) {
  if (positionId === undefined || positionId === null || positionId === '') return employee.position_id;
  const id = Number(positionId);
  const position = Number.isInteger(id) ? await positionRepository.findActiveById(id) : null;
  if (!position) {
    res.status(400).json({ message: 'Invalid position_id', code: 'INVALID_POSITION' });
    return null;
  }
  return position.id;
}

function respondDuplicate(res) {
  return res.status(409).json({
    message: 'This employee is already assigned to this shift on this date',
    code: 'DUPLICATE_ASSIGNMENT',
  });
}

function respondOverlap(res, conflict) {
  return res.status(409).json({
    message: 'This employee already has an overlapping shift',
    code: 'SHIFT_OVERLAP',
    conflict: {
      id: conflict.id,
      shift_id: conflict.shift_id,
      date: conflict.date,
      start_at: conflict.start_at,
      end_at: conflict.end_at,
    },
  });
}

// GET /api/shiftAssignment?branchId=&employeeId=&date=&status= (shiftAssignment.read
// permission, owner-scoped) — management view for a Branch Admin / Super Admin. A Super Admin
// may omit branchId to see every branch.
async function list(req, res) {
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.employeeId) filter.employee_id = Number(req.query.employeeId);
  if (req.query.date) filter.date = req.query.date;
  if (req.query.status) filter.status = req.query.status;

  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await shiftAssignmentRepository.findAll(filter, { skip, limit });
  const enriched = await withPositionSummaries(data.map((assignment) => assignment.toJSON()));
  res.json(buildPaginatedResult({ data: enriched, total, page, limit }));
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
  const withPositions = await withPositionSummaries(data.map((assignment) => assignment.toJSON()));
  const enriched = withPositions.map((assignment) => withShiftSummary(assignment, shiftById.get(assignment.shift_id)));

  res.json(buildPaginatedResult({ data: enriched, total, page, limit }));
}

// POST /api/shiftAssignment { employee_id, shift_id, position_id?, date, start_at?, end_at? }
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

  const position_id = await resolvePositionId(res, req.body.position_id, employee);
  if (position_id === null) return;

  const duplicate = await shiftAssignmentRepository.findActiveDuplicate({ employee_id, shift_id, date });
  if (duplicate) return respondDuplicate(res);

  const times = resolveTimes(shift, date, req.body);
  if (!times) return res.status(400).json({ message: 'start_at must be before end_at', code: 'INVALID_TIME_RANGE' });
  const { start_at, end_at } = times;

  const overlap = await shiftAssignmentRepository.findOverlapping({ employee_id: employee.id, start_at, end_at });
  if (overlap) return respondOverlap(res, overlap);

  const id = await nextId('shiftAssignment');
  const assignment = await shiftAssignmentRepository.create({
    id,
    employee_id: employee.id,
    shift_id: shift.id,
    branch_id: employee.branch_id,
    position_id,
    date,
    start_at,
    end_at,
    status: 'ACTIVE',
  });

  // The check above and the insert are not atomic, so a concurrent request for an overlapping
  // range can slip past it. Re-checking after the write guarantees the later writer sees the
  // earlier one and backs out, so two overlapping shifts can never both survive.
  const raced = await shiftAssignmentRepository.findOverlapping({
    employee_id: employee.id,
    start_at,
    end_at,
    excludeId: id,
  });
  if (raced) {
    await shiftAssignmentRepository.remove(id);
    return respondOverlap(res, raced);
  }

  await broadcastAssignment(assignment, REALTIME_ACTION.CREATED, employee);
  res.status(201).json(assignment);
}

// PUT /api/shiftAssignment/:id { shift_id, position_id, date, start_at, end_at, status }
// (shiftAssignment.update permission, owner-scoped) — employee_id is immutable; re-assigning
// to a different employee is a new assignment, not an edit of this one.
async function update(req, res) {
  const existing = await shiftAssignmentRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Shift assignment not found' });

  if (req.body.status !== undefined && !['ACTIVE', 'CANCELLED'].includes(req.body.status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const updates = {};
  // Bringing a cancelled assignment back to life re-books the slot, so it needs every check a
  // brand-new assignment does — not just the ones a timing edit triggers.
  const reactivating = req.body.status === 'ACTIVE' && existing.status !== 'ACTIVE';
  const shiftOrDateChanged = req.body.shift_id !== undefined || req.body.date !== undefined;
  const timingChanged = shiftOrDateChanged || req.body.start_at !== undefined || req.body.end_at !== undefined;
  const needsSlotChecks = timingChanged || reactivating;

  if (needsSlotChecks) {
    const shift_id = req.body.shift_id !== undefined ? req.body.shift_id : existing.shift_id;
    const date = req.body.date !== undefined ? req.body.date : existing.date;
    if (req.body.date !== undefined && !DATE_RE.test(date)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD', code: 'INVALID_DATE_FORMAT' });
    }

    const validated = await validateAssignment(res, { employee_id: existing.employee_id, shift_id });
    if (!validated) return;
    const { shift } = validated;

    const slotChanged = Number(shift_id) !== existing.shift_id || date !== existing.date;
    if ((shiftOrDateChanged && slotChanged) || reactivating) {
      const duplicate = await shiftAssignmentRepository.findActiveDuplicate({
        employee_id: existing.employee_id,
        shift_id,
        date,
        excludeId: existing.id,
      });
      if (duplicate) return respondDuplicate(res);
    }

    const times = resolveTimes(shift, date, req.body);
    if (!times) return res.status(400).json({ message: 'start_at must be before end_at', code: 'INVALID_TIME_RANGE' });

    // Only a live assignment occupies time; one being cancelled in the same request doesn't.
    const willBeActive = (req.body.status !== undefined ? req.body.status : existing.status) === 'ACTIVE';
    if (willBeActive) {
      const overlap = await shiftAssignmentRepository.findOverlapping({
        employee_id: existing.employee_id,
        start_at: times.start_at,
        end_at: times.end_at,
        excludeId: existing.id,
      });
      if (overlap) return respondOverlap(res, overlap);
    }

    updates.shift_id = Number(shift_id);
    updates.date = date;
    updates.start_at = times.start_at;
    updates.end_at = times.end_at;
  }

  if (req.body.position_id !== undefined) {
    const employee = await employeeRepository.findById(existing.employee_id);
    const position_id = await resolvePositionId(res, req.body.position_id, employee);
    if (position_id === null) return;
    updates.position_id = position_id;
  }

  if (req.body.status !== undefined) updates.status = req.body.status;

  const previous = {};
  for (const key of ['shift_id', 'date', 'start_at', 'end_at', 'status']) {
    if (key in updates) previous[key] = existing[key];
  }

  const assignment = await shiftAssignmentRepository.updateFields(existing.id, updates);

  // Same non-atomic-check guard as create; on a lost race the edit is rolled back.
  if (needsSlotChecks && assignment.status === 'ACTIVE') {
    const raced = await shiftAssignmentRepository.findOverlapping({
      employee_id: assignment.employee_id,
      start_at: assignment.start_at,
      end_at: assignment.end_at,
      excludeId: assignment.id,
    });
    if (raced) {
      await shiftAssignmentRepository.updateFields(existing.id, previous);
      return respondOverlap(res, raced);
    }
  }

  await broadcastAssignment(assignment, REALTIME_ACTION.UPDATED);
  res.json(assignment);
}

// DELETE /api/shiftAssignment/:id (shiftAssignment.delete permission, owner-scoped)
async function remove(req, res) {
  const existing = await shiftAssignmentRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Shift assignment not found' });

  await shiftAssignmentRepository.remove(existing.id);
  await broadcastAssignment(existing, REALTIME_ACTION.DELETED);
  res.json({ message: 'Deleted' });
}

module.exports = { list, listMine, create, update, remove };
