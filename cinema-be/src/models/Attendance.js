const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'];

// One row per employee per work day. PRESENT / LATE rows carry the clock_in ... clock_out
// timestamps; ABSENT / ON_LEAVE rows are recorded by a manager (or the absence sweep) and never
// have a clock_in.
const attendanceSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    employee_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    // Calendar day in `timezone` (YYYY-MM-DD), derived by the server — never taken from a client.
    work_date: { type: String, required: true },
    // IANA zone work_date was computed in, kept on the row so a later change to the branch's
    // setting does not reinterpret history.
    timezone: { type: String, required: true },
    // The roster entry this clock-in was matched against, when there was one (drives LATE).
    shift_assignment_id: { type: Number, default: null },
    clock_in: { type: Date, default: null },
    clock_out: { type: Date, default: null },
    // A single break per day: break_start -> break_end.
    break_start: { type: Date, default: null },
    break_end: { type: Date, default: null },
    status: { type: String, enum: STATUSES, required: true, index: true },
    note: { type: String, default: null },
    // Account id of the manager who marked or corrected the row; null for self-service rows and
    // for the automatic absence sweep.
    recorded_by: { type: Number, default: null },
  },
  { timestamps: true },
);

// The guarantee behind "no double clock-in": the second insert for the same day loses.
attendanceSchema.index({ employee_id: 1, work_date: 1 }, { unique: true });
attendanceSchema.index({ branch_id: 1, work_date: -1 });

withCleanJSON(attendanceSchema);

const Attendance = mongoose.model('Attendance', attendanceSchema);
Attendance.STATUSES = STATUSES;

module.exports = Attendance;
