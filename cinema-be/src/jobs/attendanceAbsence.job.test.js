const attendanceService = require('../services/attendance.service');

jest.mock('../services/attendance.service', () => ({
  markAbsentees: jest.fn().mockResolvedValue(0),
}));

describe('startAttendanceAbsenceSweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically flags ended shifts that have no attendance', async () => {
    const { startAttendanceAbsenceSweep, SWEEP_INTERVAL_MS } = require('./attendanceAbsence.job');
    const timer = startAttendanceAbsenceSweep();

    expect(attendanceService.markAbsentees).not.toHaveBeenCalled();

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(attendanceService.markAbsentees).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(attendanceService.markAbsentees).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('logs a failed sweep instead of crashing, and keeps running', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    attendanceService.markAbsentees.mockRejectedValueOnce(new Error('db down'));
    const { startAttendanceAbsenceSweep, SWEEP_INTERVAL_MS } = require('./attendanceAbsence.job');
    const timer = startAttendanceAbsenceSweep();

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('attendanceAbsenceSweep'), expect.any(Error));

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(attendanceService.markAbsentees).toHaveBeenCalledTimes(2);

    clearInterval(timer);
    errorSpy.mockRestore();
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startAttendanceAbsenceSweep } = require('./attendanceAbsence.job');
    const timer = startAttendanceAbsenceSweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
