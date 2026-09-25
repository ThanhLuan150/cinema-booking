const attendanceRepository = require('../repositories/attendance.repository');
const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const employeeRepository = require('../repositories/employee.repository');
const branchRepository = require('../repositories/branch.repository');
const systemConfigService = require('./systemConfig.service');
const { recordAudit, ACTION, ENTITY_TYPE } = require('./auditLog.service');
const nextId = require('../utils/nextId');
const { normalizeTimeZone, DEFAULT_TIMEZONE } = require('../utils/attendanceTime');
const { emitToAdmin, emitToOwner, emitToAccount } = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');

const MINUTE_MS = 60 * 1000;
const ABSENCE_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

// Where a record is in the Clock In -> Break -> Resume -> Clock Out flow.
const SESSION_STATE = {
  NOT_STARTED: 'NOT_STARTED', // no clock_in (ABSENT / ON_LEAVE rows, or nothing recorded today)
  WORKING: 'WORKING',
  ON_BREAK: 'ON_BREAK',
  CLOCKED_OUT: 'CLOCKED_OUT',
};

function sessionState(record) {
  if (!record || !record.clock_in) return SESSION_STATE.NOT_STARTED;
  if (record.clock_out) return SESSION_STATE.CLOCKED_OUT;
  if (record.break_start && !record.break_end) return SESSION_STATE.ON_BREAK;
  return SESSION_STATE.WORKING;
}

function minutesBetween(from, to) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MINUTE_MS));
}

// Break time so far. A break still running is measured up to `until`.
function breakMinutes(record, until) {
  if (!record.break_start) return 0;
  const end = record.break_end || record.clock_out || until;
  return minutesBetween(record.break_start, end);
}

// Time on the clock, breaks excluded. An open session is measured up to `now`.
function workedMinutes(record, now = new Date()) {
  if (!record.clock_in) return 0;
  const end = record.clock_out || now;
  return Math.max(0, minutesBetween(record.clock_in, end) - breakMinutes(record, end));
}

// API shape: the stored row plus the derived fields the UI would otherwise have to recompute.
function serialize(record, now = new Date()) {
  const json = record.toJSON();
  return {
    ...json,
    session_state: sessionState(record),
    worked_minutes: workedMinutes(record, now),
    break_minutes: breakMinutes(record, record.clock_out || now),
  };
}

// The roster entry a clock-in is judged against: of the day's live assignments, the one that
// starts closest to the moment of clock-in (covers a split day without guessing by index).
function pickAssignment(assignments, clockIn) {
  let best = null;
  let bestGap = Infinity;
  for (const assignment of assignments) {
    const gap = Math.abs(assignment.start_at.getTime() - clockIn.getTime());
    if (gap < bestGap) {
      best = assignment;
      bestGap = gap;
    }
  }
  return best;
}

// PRESENT unless there is a roster entry and the clock-in is past its start plus the grace
// period. No roster entry -> nothing to be late for.
function statusForClockIn({ clockIn, assignment, graceMinutes }) {
  if (!assignment) return 'PRESENT';
  const lateAfter = assignment.start_at.getTime() + graceMinutes * MINUTE_MS;
  return clockIn.getTime() > lateAfter ? 'LATE' : 'PRESENT';
}

// The timezone work days are cut in for a branch: the (branch-overridable) setting, falling
// back to the default if a stored value ever stops being a real zone.
async function timezoneForBranch(branchId) {
  const configured = await systemConfigService.getValue('ATTENDANCE_TIMEZONE', branchId);
  return normalizeTimeZone(configured) || DEFAULT_TIMEZONE;
}

async function lateGraceMinutes(branchId) {
  return systemConfigService.getValue('ATTENDANCE_LATE_GRACE', branchId);
}

// Attendance is personal data, so this deliberately does NOT use the branch room
// (`emitBranchEvent`): every active employee of the branch is in it, and one employee must not
// learn that a colleague clocked in late or was marked absent. It goes to exactly the audiences
// that may read the row over HTTP (attendance.read): the employee it is about, the branch's own
// Branch Admin, and Super Admin. They are three different sockets' rooms, so nobody receives it
// twice. Non-throwing: a failed lookup or emit must never fail a clock action.
async function broadcast(record, action) {
  try {
    const payload = {
      action,
      id: record.id,
      employeeId: record.employee_id,
      workDate: record.work_date,
      status: record.status,
      sessionState: sessionState(record),
      branchId: record.branch_id,
    };
    const [employee, branch] = await Promise.all([
      employeeRepository.findById(record.employee_id),
      branchRepository.findById(record.branch_id),
    ]);
    emitToAdmin(REALTIME_EVENT.ATTENDANCE_UPDATED, payload);
    if (branch) emitToOwner(branch.owner_id, REALTIME_EVENT.ATTENDANCE_UPDATED, payload);
    if (employee) emitToAccount(employee.user_id, REALTIME_EVENT.ATTENDANCE_UPDATED, payload);
  } catch (err) {
    console.error('[attendance] failed to broadcast', record && record.id, err.message);
  }
}

// Flags roster entries that ended with no attendance at all as ABSENT. Idempotent: a re-run, or
// a manager having already marked the day, leaves the existing row alone. Returns the number of
// rows created.
async function markAbsentees(now = new Date()) {
  const assignments = await shiftAssignmentRepository.findActiveEndedBetween(
    new Date(now.getTime() - ABSENCE_LOOKBACK_MS),
    now,
  );

  let created = 0;
  for (const assignment of assignments) {
    const employee = await employeeRepository.findById(assignment.employee_id);
    if (!employee || employee.status !== 1) continue;

    const turnedUp = await attendanceRepository.existsForShiftWindow(
      assignment.employee_id,
      assignment.date,
      new Date(assignment.start_at.getTime() - 2 * 60 * MINUTE_MS),
      assignment.end_at,
    );
    if (turnedUp) continue;

    try {
      const record = await attendanceRepository.create({
        id: await nextId('attendance'),
        employee_id: assignment.employee_id,
        branch_id: assignment.branch_id,
        work_date: assignment.date,
        timezone: await timezoneForBranch(assignment.branch_id),
        shift_assignment_id: assignment.id,
        status: 'ABSENT',
        note: 'No clock-in recorded for the assigned shift',
      });
      created += 1;
      await recordAudit({
        performedBy: null,
        action: ACTION.ATTENDANCE_AUTO_ABSENT,
        entityType: ENTITY_TYPE.ATTENDANCE,
        entityId: record.id,
        branchId: record.branch_id,
        metadata: { employeeId: record.employee_id, workDate: record.work_date, shiftAssignmentId: assignment.id },
      });
      await broadcast(record, 'CREATED');
    } catch (err) {
      // A unique-index collision means the day already has a row (e.g. a second assignment on
      // the same day) — nothing to do.
      if (err && err.code !== 11000) throw err;
    }
  }
  return created;
}

module.exports = {
  SESSION_STATE,
  sessionState,
  workedMinutes,
  breakMinutes,
  serialize,
  pickAssignment,
  statusForClockIn,
  timezoneForBranch,
  lateGraceMinutes,
  broadcast,
  markAbsentees,
};
