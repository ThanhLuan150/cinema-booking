import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

import * as attendanceApi from './attendance.api';

describe('attendance.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: { ok: true } });
    postMock.mockReset().mockResolvedValue({ data: { ok: true } });
    patchMock.mockReset().mockResolvedValue({ data: { ok: true } });
  });

  it('getTodayAttendance gets /attendance/today and unwraps the body', async () => {
    expect(await attendanceApi.getTodayAttendance()).toEqual({ ok: true });
    expect(getMock).toHaveBeenCalledWith('/attendance/today');
  });

  it.each([
    ['clockIn', '/attendance/clock-in'],
    ['startBreak', '/attendance/break/start'],
    ['endBreak', '/attendance/break/end'],
    ['clockOut', '/attendance/clock-out'],
  ] as const)('%s posts to %s with the branch timezone and never an employee id', async (fn, url) => {
    await attendanceApi[fn]('Asia/Ho_Chi_Minh');
    expect(postMock).toHaveBeenCalledWith(url, { timezone: 'Asia/Ho_Chi_Minh' });
  });

  it('getMyAttendance gets /attendance/me with filters', async () => {
    await attendanceApi.getMyAttendance({ page: 2, limit: 10, status: 'LATE', from: '2026-09-01' });
    expect(getMock).toHaveBeenCalledWith('/attendance/me', {
      params: { page: 2, limit: 10, status: 'LATE', from: '2026-09-01' },
    });
  });

  it('getAttendance gets /attendance with branchId + filters', async () => {
    await attendanceApi.getAttendance(3, { page: 1, employeeId: 7, to: '2026-09-30' });
    expect(getMock).toHaveBeenCalledWith('/attendance', {
      params: { branchId: 3, page: 1, employeeId: 7, to: '2026-09-30' },
    });
  });

  it('getAttendance leaves branchId undefined for the all-branches view', async () => {
    await attendanceApi.getAttendance(undefined, { page: 1 });
    expect(getMock).toHaveBeenCalledWith('/attendance', { params: { branchId: undefined, page: 1 } });
  });

  it('markAttendance posts the payload to /attendance/mark', async () => {
    const payload = { employee_id: 1, work_date: '2026-09-20', status: 'ABSENT' as const, note: 'No show' };
    await attendanceApi.markAttendance(payload);
    expect(postMock).toHaveBeenCalledWith('/attendance/mark', payload);
  });

  it('closeAttendanceSession patches /attendance/:id/close', async () => {
    const payload = { clock_out: '2026-09-10T17:30:00+07:00', note: 'Forgot' };
    await attendanceApi.closeAttendanceSession(9, payload);
    expect(patchMock).toHaveBeenCalledWith('/attendance/9/close', payload);
  });
});
