const attendanceService = require('../services/attendance.service');

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

// Flags roster entries that ended with no clock-in as ABSENT. Runs often because an entry only
// becomes eligible once its shift has ended, and the pass is cheap and idempotent.
function startAttendanceAbsenceSweep() {
  const timer = setInterval(() => {
    attendanceService.markAbsentees().catch((err) => {
      console.error('[attendanceAbsenceSweep] failed to mark absences', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startAttendanceAbsenceSweep, SWEEP_INTERVAL_MS };
