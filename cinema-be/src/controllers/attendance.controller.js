const attendanceRepository = require('../repositories/attendance.repository');
const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const employeeRepository = require('../repositories/employee.repository');
const authRepository = require('../repositories/auth.repository');
const Attendance = require('../models/Attendance');
const attendanceService = require('../services/attendance.service');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { REALTIME_ACTION } = require('../utils/realtimeEvents');
const {
  isValidTimeZone,
  sameTimeZone,
  isValidDateString,
  workDateFor,
  parseOffsetTimestamp,
} = require('../utils/attendanceTime');

const MARKABLE_STATUSES = ['ABSENT', 'ON_LEAVE'];
const DUPLICATE_KEY = 11000;

// A collision on the one-row-per-employee-per-day index specifically (not, say, the id).
function isDuplicateDay(err) {
  return Boolean(err && err.code === DUPLICATE_KEY && err.keyPattern && err.keyPattern.work_date);
}

function reject(res, status, code, message, extra = {}) {
  return res.status(status).json({ message, code, ...extra });
}

// ---- self-service ----------------------------------------------------------

// The caller's own, active employee record. Attendance is always about the person holding the
// token: no endpoint here accepts an employee id for a clock action, so nobody can clock in
// (or out) for a colleague. Sends the error itself and returns null when there is no one to
// clock for.
async function resolveSelf(req, res) {
  const employee = await employeeRepository.findByAccountId(req.account.accountId);
  if (!employee) {
    reject(res, 403, 'ATTENDANCE_NOT_EMPLOYEE', 'Only an employee can record attendance');
    return null;
  }
  if (employee.status !== 1) {
    reject(res, 403, 'EMPLOYEE_NOT_ACTIVE', 'Employee is not active');
    return null;
  }
  return employee;
}

// The server decides the instant and the work day. A client may state which timezone it thinks
// the branch is in, but only to be told when it is wrong: an unknown zone is malformed input, a
// known-but-different zone means the caller is working from the wrong idea of "today".
// Returns the branch timezone, or null after sending the error.
async function resolveBranchTimezone(req, res, branchId) {
  const branchZone = await attendanceService.timezoneForBranch(branchId);
  const claimed = req.body ? req.body.timezone : undefined;
  if (claimed === undefined || claimed === null || claimed === '') return branchZone;

  if (!isValidTimeZone(claimed)) {
    reject(res, 400, 'INVALID_TIMEZONE', 'timezone must be a valid IANA timezone such as Asia/Ho_Chi_Minh');
    return null;
  }
  if (!sameTimeZone(claimed, branchZone)) {
    reject(res, 400, 'TIMEZONE_MISMATCH', `This branch records attendance in ${branchZone}`, { expected: branchZone });
    return null;
  }
  return branchZone;
}

async function auditSelf(req, record, action, extra = {}) {
  await recordAudit({
    req,
    action,
    entityType: ENTITY_TYPE.ATTENDANCE,
    entityId: record.id,
    branchId: record.branch_id,
    metadata: { employeeId: record.employee_id, workDate: record.work_date, ...extra },
  });
}

// GET /api/attendance/today (attendance.clock) — where the caller is in the flow right now.
// Reports the open session if there is one (even from a previous day), else today's row.
async function today(req, res) {
  const employee = await resolveSelf(req, res);
  if (!employee) return;

  const timezone = await attendanceService.timezoneForBranch(employee.branch_id);
  const now = new Date();
  const workDate = workDateFor(now, timezone);
  const record =
    (await attendanceRepository.findOpenSession(employee.id)) ||
    (await attendanceRepository.findByEmployeeAndDate(employee.id, workDate));

  res.json({
    work_date: workDate,
    timezone,
    server_time: now.toISOString(),
    session_state: attendanceService.sessionState(record),
    attendance: record ? attendanceService.serialize(record, now) : null,
  });
}

// POST /api/attendance/clock-in { timezone? } (attendance.clock)
async function clockIn(req, res) {
  const employee = await resolveSelf(req, res);
  if (!employee) return;
  const timezone = await resolveBranchTimezone(req, res, employee.branch_id);
  if (!timezone) return;

  const now = new Date();
  const workDate = workDateFor(now, timezone);

  const open = await attendanceRepository.findOpenSession(employee.id);
  if (open) {
    return reject(res, 409, 'ACTIVE_SESSION_EXISTS', 'You already have an active attendance session', {
      attendance: attendanceService.serialize(open, now),
    });
  }

  const existing = await attendanceRepository.findByEmployeeAndDate(employee.id, workDate);
  if (existing) {
    return existing.clock_in
      ? reject(res, 409, 'ALREADY_CLOCKED_OUT', 'Attendance for today is already complete', {
          attendance: attendanceService.serialize(existing, now),
        })
      : reject(res, 409, 'ATTENDANCE_ALREADY_RECORDED', `Today is already recorded as ${existing.status}`, {
          attendance: attendanceService.serialize(existing, now),
        });
  }

  const assignments = await shiftAssignmentRepository.findActiveForEmployeeOnDate(employee.id, workDate);
  const assignment = attendanceService.pickAssignment(assignments, now);
  const graceMinutes = await attendanceService.lateGraceMinutes(employee.branch_id);
  const status = attendanceService.statusForClockIn({ clockIn: now, assignment, graceMinutes });

  let record;
  try {
    record = await attendanceRepository.create({
      id: await nextId('attendance'),
      employee_id: employee.id,
      branch_id: employee.branch_id,
      work_date: workDate,
      timezone,
      shift_assignment_id: assignment ? assignment.id : null,
      clock_in: now,
      status,
    });
  } catch (err) {
    // A concurrent clock-in for the same day won the (employee, work_date) unique index.
    if (isDuplicateDay(err)) {
      return reject(res, 409, 'ACTIVE_SESSION_EXISTS', 'You already have an active attendance session');
    }
    throw err;
  }

  await auditSelf(req, record, ACTION.ATTENDANCE_CLOCK_IN, {
    status,
    timezone,
    shiftAssignmentId: record.shift_assignment_id,
  });
  await attendanceService.broadcast(record, REALTIME_ACTION.CREATED);
  res.status(201).json(attendanceService.serialize(record, now));
}

// The open session for a break/clock-out action, or null after sending NOT_CLOCKED_IN.
async function requireOpenSession(res, employee) {
  const open = await attendanceRepository.findOpenSession(employee.id);
  if (!open) {
    reject(res, 409, 'NOT_CLOCKED_IN', 'You are not clocked in');
    return null;
  }
  return open;
}

// POST /api/attendance/break/start (attendance.clock)
async function startBreak(req, res) {
  const employee = await resolveSelf(req, res);
  if (!employee) return;
  if (!(await resolveBranchTimezone(req, res, employee.branch_id))) return;

  const open = await requireOpenSession(res, employee);
  if (!open) return;

  const now = new Date();
  const updated = await attendanceRepository.startBreak(open.id, now);
  if (!updated) {
    const current = await attendanceRepository.findById(open.id);
    if (current && current.break_start && !current.break_end) {
      return reject(res, 409, 'ALREADY_ON_BREAK', 'You are already on a break');
    }
    if (current && current.break_start) {
      return reject(res, 409, 'BREAK_ALREADY_TAKEN', 'The break for this session has already been taken');
    }
    return reject(res, 409, 'NOT_CLOCKED_IN', 'You are not clocked in');
  }

  await attendanceService.broadcast(updated, REALTIME_ACTION.UPDATED);
  res.json(attendanceService.serialize(updated, now));
}

// POST /api/attendance/break/end (attendance.clock)
async function endBreak(req, res) {
  const employee = await resolveSelf(req, res);
  if (!employee) return;
  if (!(await resolveBranchTimezone(req, res, employee.branch_id))) return;

  const open = await requireOpenSession(res, employee);
  if (!open) return;

  const now = new Date();
  const updated = await attendanceRepository.endBreak(open.id, now);
  if (!updated) return reject(res, 409, 'NOT_ON_BREAK', 'You are not on a break');

  await attendanceService.broadcast(updated, REALTIME_ACTION.UPDATED);
  res.json(attendanceService.serialize(updated, now));
}

// POST /api/attendance/clock-out { timezone? } (attendance.clock)
async function clockOut(req, res) {
  const employee = await resolveSelf(req, res);
  if (!employee) return;
  if (!(await resolveBranchTimezone(req, res, employee.branch_id))) return;

  const open = await requireOpenSession(res, employee);
  if (!open) return;

  const now = new Date();
  const updated = await attendanceRepository.clockOut(open.id, now);
  if (!updated) {
    const current = await attendanceRepository.findById(open.id);
    if (current && current.break_start && !current.break_end && !current.clock_out) {
      return reject(res, 409, 'ON_BREAK', 'End your break before clocking out');
    }
    return reject(res, 409, 'NOT_CLOCKED_IN', 'You are not clocked in');
  }

  await auditSelf(req, updated, ACTION.ATTENDANCE_CLOCK_OUT, {
    status: updated.status,
    workedMinutes: attendanceService.workedMinutes(updated, now),
  });
  await attendanceService.broadcast(updated, REALTIME_ACTION.UPDATED);
  res.json(attendanceService.serialize(updated, now));
}

// ---- reading ----------------------------------------------------------------

function parseRangeFilter(query) {
  const { from, to } = query;
  if (from !== undefined && from !== '' && !isValidDateString(from)) {
    return { error: { code: 'INVALID_DATE', message: 'from must be a valid YYYY-MM-DD date' } };
  }
  if (to !== undefined && to !== '' && !isValidDateString(to)) {
    return { error: { code: 'INVALID_DATE', message: 'to must be a valid YYYY-MM-DD date' } };
  }
  if (from && to && from > to) {
    return { error: { code: 'INVALID_DATE_RANGE', message: 'from must not be after to' } };
  }
  const range = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return { range: Object.keys(range).length ? range : null };
}

// Adds who the row belongs to, so a manager's table does not have to show bare ids.
async function withEmployeeSummaries(records, now = new Date()) {
  const employeeIds = [...new Set(records.map((r) => r.employee_id))];
  const employees = await Promise.all(employeeIds.map((id) => employeeRepository.findById(id)));
  const employeeById = new Map(employees.filter(Boolean).map((e) => [e.id, e]));
  const accounts = await authRepository.findByFilter({
    id: { $in: [...employeeById.values()].map((e) => e.user_id) },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return records.map((record) => {
    const employee = employeeById.get(record.employee_id);
    const account = employee ? accountById.get(employee.user_id) : null;
    return {
      ...attendanceService.serialize(record, now),
      employee: employee
        ? { id: employee.id, employee_code: employee.employee_code, name: account?.name, email: account?.email }
        : undefined,
    };
  });
}

// Builds the { filter } or sends the 400. `base` carries the scope (branch / employee).
function buildListFilter(req, res, base) {
  const { range, error } = parseRangeFilter(req.query);
  if (error) {
    reject(res, 400, error.code, error.message);
    return null;
  }
  const filter = { ...base };
  if (range) filter.work_date = range;
  if (req.query.status) {
    if (!Attendance.STATUSES.includes(req.query.status)) {
      reject(res, 400, 'INVALID_STATUS', `status must be one of: ${Attendance.STATUSES.join(', ')}`);
      return null;
    }
    filter.status = req.query.status;
  }
  return filter;
}

// GET /api/attendance/me?from=&to=&status= (attendance.read) — the caller's own history.
async function listMine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const employee = await employeeRepository.findByAccountId(req.account.accountId);
  if (!employee) return res.json(buildPaginatedResult({ data: [], total: 0, page, limit }));

  const filter = buildListFilter(req, res, { employee_id: employee.id });
  if (!filter) return;

  const { data, total } = await attendanceRepository.findAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data: await withEmployeeSummaries(data), total, page, limit }));
}

// GET /api/attendance?branchId=&employeeId=&status=&from=&to= (attendance.read)
//  - OWN scope (Employee): always the caller's own rows, whatever the query says.
//  - BRANCH scope (Branch Admin): their branch; the route has already checked ownership.
//  - ALL scope (Super Admin): every branch, or one via ?branchId.
async function list(req, res) {
  if (req.permissionScope === 'OWN') return listMine(req, res);

  const base = {};
  if (req.branchId !== null && req.branchId !== undefined) base.branch_id = req.branchId;
  if (req.query.employeeId) base.employee_id = Number(req.query.employeeId);

  const filter = buildListFilter(req, res, base);
  if (!filter) return;

  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await attendanceRepository.findAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data: await withEmployeeSummaries(data), total, page, limit }));
}

// GET /api/attendance/:id (attendance.read). An Employee asking for someone else's row gets the
// same 404 as for a row that does not exist, so ids cannot be probed.
async function getOne(req, res) {
  const record = await attendanceRepository.findById(req.params.id);
  if (!record) return reject(res, 404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found');

  if (req.permissionScope === 'OWN') {
    const employee = await employeeRepository.findByAccountId(req.account.accountId);
    if (!employee || employee.id !== record.employee_id) {
      return reject(res, 404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found');
    }
  }
  const [enriched] = await withEmployeeSummaries([record]);
  res.json(enriched);
}

// ---- manager actions ----------------------------------------------------------

// POST /api/attendance/mark { employee_id, work_date, status: ABSENT|ON_LEAVE, note? }
// (attendance.manage, branch-owner scoped to the employee's branch). Records a day the employee
// did not work. Never replaces a day that has a clock-in.
async function mark(req, res) {
  const { employee_id, work_date, status } = req.body;
  const note = typeof req.body.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;

  if (!MARKABLE_STATUSES.includes(status)) {
    return reject(res, 400, 'INVALID_STATUS', `status must be one of: ${MARKABLE_STATUSES.join(', ')}`);
  }
  if (!isValidDateString(work_date)) {
    return reject(res, 400, 'INVALID_DATE', 'work_date must be a valid YYYY-MM-DD date');
  }

  const employee = await employeeRepository.findById(employee_id);
  if (!employee) return reject(res, 404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
  if (employee.status !== 1) return reject(res, 400, 'EMPLOYEE_NOT_ACTIVE', 'Employee is not active');

  const timezone = await attendanceService.timezoneForBranch(employee.branch_id);
  // Absence can only be recorded for a day that has started; leave may be booked ahead.
  if (status === 'ABSENT' && work_date > workDateFor(new Date(), timezone)) {
    return reject(res, 400, 'FUTURE_DATE', 'A future day cannot be marked ABSENT');
  }

  const accountId = req.account.accountId;
  const existing = await attendanceRepository.findByEmployeeAndDate(employee.id, work_date);
  let record;
  let previousStatus = null;

  if (existing) {
    previousStatus = existing.status;
    record = await attendanceRepository.overwriteMark(existing.id, { status, note, recordedBy: accountId });
    if (!record) {
      return reject(res, 409, 'HAS_CLOCK_IN', 'This day has recorded working time and cannot be re-marked');
    }
  } else {
    try {
      record = await attendanceRepository.create({
        id: await nextId('attendance'),
        employee_id: employee.id,
        branch_id: employee.branch_id,
        work_date,
        timezone,
        status,
        note,
        recorded_by: accountId,
      });
    } catch (err) {
      if (isDuplicateDay(err)) {
        return reject(res, 409, 'ATTENDANCE_EXISTS', 'Attendance for this day was just recorded; retry');
      }
      throw err;
    }
  }

  await recordAudit({
    req,
    action: ACTION.ATTENDANCE_MARKED,
    entityType: ENTITY_TYPE.ATTENDANCE,
    entityId: record.id,
    branchId: record.branch_id,
    reason: note,
    metadata: { employeeId: record.employee_id, workDate: record.work_date, status, previousStatus },
  });
  await attendanceService.broadcast(record, existing ? REALTIME_ACTION.UPDATED : REALTIME_ACTION.CREATED);
  res.status(existing ? 200 : 201).json(attendanceService.serialize(record));
}

// PATCH /api/attendance/:id/close { clock_out, note } (attendance.manage, branch-owner scoped)
// — closes a session the employee never clocked out of. `clock_out` must be an ISO-8601
// timestamp that states its own offset (Z or +07:00): a bare local time would have to be
// interpreted in some zone, and that is exactly the guess this module refuses to make.
async function closeSession(req, res) {
  const record = await attendanceRepository.findById(req.params.id);
  if (!record) return reject(res, 404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found');

  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!note) return reject(res, 400, 'REASON_REQUIRED', 'note is required to correct a session');

  const closeAt = parseOffsetTimestamp(req.body.clock_out);
  if (!closeAt) {
    return reject(res, 400, 'INVALID_TIMESTAMP', 'clock_out must be an ISO-8601 timestamp with a timezone offset');
  }
  if (!record.clock_in || record.clock_out) {
    return reject(res, 409, 'SESSION_NOT_OPEN', 'This record has no open session to close');
  }
  if (closeAt <= record.clock_in) {
    return reject(res, 400, 'INVALID_TIME_RANGE', 'clock_out must be after clock_in');
  }
  if (closeAt > new Date()) return reject(res, 400, 'FUTURE_TIMESTAMP', 'clock_out cannot be in the future');

  const onBreak = record.break_start && !record.break_end;
  if (onBreak && closeAt < record.break_start) {
    return reject(res, 400, 'INVALID_TIME_RANGE', 'clock_out cannot be before the break started');
  }

  const updated = await attendanceRepository.forceClose(record.id, {
    clockOut: closeAt,
    breakEnd: onBreak ? closeAt : null,
    note,
    recordedBy: req.account.accountId,
  });
  if (!updated) return reject(res, 409, 'SESSION_NOT_OPEN', 'This record has no open session to close');

  await recordAudit({
    req,
    action: ACTION.ATTENDANCE_CORRECTED,
    entityType: ENTITY_TYPE.ATTENDANCE,
    entityId: updated.id,
    branchId: updated.branch_id,
    reason: note,
    metadata: {
      employeeId: updated.employee_id,
      workDate: updated.work_date,
      clockOut: closeAt.toISOString(),
      endedBreak: Boolean(onBreak),
    },
  });
  await attendanceService.broadcast(updated, REALTIME_ACTION.UPDATED);
  res.json(attendanceService.serialize(updated));
}

module.exports = {
  today,
  clockIn,
  startBreak,
  endBreak,
  clockOut,
  listMine,
  list,
  getOne,
  mark,
  closeSession,
};
