const Attendance = require('../models/Attendance');

async function findById(id) {
  return Attendance.findOne({ id: Number(id) });
}

async function findByEmployeeAndDate(employeeId, workDate) {
  return Attendance.findOne({ employee_id: Number(employeeId), work_date: workDate });
}

// A session that was clocked in and never clocked out — on any work day, so a forgotten
// clock-out from yesterday still blocks a second clock-in today.
async function findOpenSession(employeeId) {
  return Attendance.findOne({
    employee_id: Number(employeeId),
    clock_in: { $ne: null },
    clock_out: null,
  }).sort({ clock_in: -1 });
}

async function findAll(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Attendance.find(filter).sort({ work_date: -1, id: -1 }).skip(skip).limit(limit),
    Attendance.countDocuments(filter),
  ]);
  return { data, total };
}

// Did the employee turn up for a roster entry? Matches either the work day itself or any
// clock-in inside the entry's window, so a clock-in that lands on the neighbouring calendar
// day (an early start, an overnight shift) still counts.
async function existsForShiftWindow(employeeId, workDate, from, to) {
  return Attendance.exists({
    employee_id: Number(employeeId),
    $or: [{ work_date: workDate }, { clock_in: { $gte: from, $lte: to } }],
  });
}

async function create(data) {
  return Attendance.create(data);
}

// The transitions below are single conditional updates: the state guard lives in the filter, so
// two racing requests (a double-tap, two devices) cannot both win. The loser gets null and the
// caller re-reads the row to report why.

async function startBreak(id, at) {
  return Attendance.findOneAndUpdate(
    { id: Number(id), clock_in: { $ne: null }, clock_out: null, break_start: null },
    { $set: { break_start: at } },
    { new: true },
  );
}

async function endBreak(id, at) {
  return Attendance.findOneAndUpdate(
    { id: Number(id), clock_out: null, break_start: { $ne: null }, break_end: null },
    { $set: { break_end: at } },
    { new: true },
  );
}

// Not while on a break: the employee has to resume first.
async function clockOut(id, at) {
  return Attendance.findOneAndUpdate(
    {
      id: Number(id),
      clock_in: { $ne: null },
      clock_out: null,
      $or: [{ break_start: null }, { break_end: { $ne: null } }],
    },
    { $set: { clock_out: at } },
    { new: true },
  );
}

// Manager correction of a session that was never closed. Guarded on the session still being
// open so it cannot overwrite a clock-out the employee has since recorded.
async function forceClose(id, { clockOut: closeAt, breakEnd, note, recordedBy }) {
  const set = { clock_out: closeAt, recorded_by: recordedBy ?? null };
  if (breakEnd) set.break_end = breakEnd;
  if (note !== undefined) set.note = note;
  return Attendance.findOneAndUpdate(
    { id: Number(id), clock_in: { $ne: null }, clock_out: null },
    { $set: set },
    { new: true },
  );
}

// A manager flags a day ABSENT / ON_LEAVE. Only a row that has no clock-in may be overwritten —
// recorded working time is never replaced by a flag.
async function overwriteMark(id, { status, note, recordedBy }) {
  return Attendance.findOneAndUpdate(
    { id: Number(id), clock_in: null },
    { $set: { status, note: note ?? null, recorded_by: recordedBy ?? null } },
    { new: true },
  );
}

module.exports = {
  findById,
  findByEmployeeAndDate,
  findOpenSession,
  findAll,
  existsForShiftWindow,
  create,
  startBreak,
  endBreak,
  clockOut,
  forceClose,
  overwriteMark,
};
