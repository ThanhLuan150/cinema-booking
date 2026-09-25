const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
jest.mock('../utils/socket');

const attendanceService = require('./attendance.service');
const systemConfigService = require('./systemConfig.service');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const Employee = require('../models/Employee');
const ShiftAssignment = require('../models/ShiftAssignment');

beforeAll(async () => {
  await connect();
  await Attendance.init();
});
beforeEach(() => systemConfigService.invalidateAll());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const T0 = new Date('2026-09-26T01:00:00Z');
const at = (minutes) => new Date(T0.getTime() + minutes * 60000);
const record = (fields) => ({ toJSON: () => ({ ...fields }), ...fields });

describe('attendance.service — session math', () => {
  describe('sessionState', () => {
    it('follows the Clock In -> Break -> Resume -> Clock Out flow', () => {
      expect(attendanceService.sessionState(null)).toBe('NOT_STARTED');
      expect(attendanceService.sessionState(record({ clock_in: null }))).toBe('NOT_STARTED');
      expect(attendanceService.sessionState(record({ clock_in: at(0) }))).toBe('WORKING');
      expect(attendanceService.sessionState(record({ clock_in: at(0), break_start: at(60) }))).toBe('ON_BREAK');
      expect(attendanceService.sessionState(record({ clock_in: at(0), break_start: at(60), break_end: at(90) }))).toBe(
        'WORKING',
      );
      expect(attendanceService.sessionState(record({ clock_in: at(0), clock_out: at(480) }))).toBe('CLOCKED_OUT');
    });
  });

  describe('workedMinutes / breakMinutes', () => {
    it('excludes the break from time worked', () => {
      const r = record({ clock_in: at(0), break_start: at(120), break_end: at(150), clock_out: at(480) });
      expect(attendanceService.breakMinutes(r, at(999))).toBe(30);
      expect(attendanceService.workedMinutes(r, at(999))).toBe(450);
    });

    it('measures an open session and a running break up to now', () => {
      const r = record({ clock_in: at(0), break_start: at(120) });
      expect(attendanceService.breakMinutes(r, at(140))).toBe(20);
      expect(attendanceService.workedMinutes(r, at(140))).toBe(120);
    });

    it('is zero without a clock-in and never negative', () => {
      expect(attendanceService.workedMinutes(record({ clock_in: null }), at(100))).toBe(0);
      expect(attendanceService.workedMinutes(record({ clock_in: at(10) }), at(0))).toBe(0);
    });
  });

  describe('serialize', () => {
    it('adds the derived fields to the stored row', () => {
      const out = attendanceService.serialize(record({ id: 5, clock_in: at(0), clock_out: at(60) }), at(999));
      expect(out).toMatchObject({ id: 5, session_state: 'CLOCKED_OUT', worked_minutes: 60, break_minutes: 0 });
    });
  });

  describe('pickAssignment / statusForClockIn', () => {
    const a = (id, startMin) => ({ id, start_at: at(startMin) });

    it('picks the assignment starting closest to the clock-in', () => {
      expect(attendanceService.pickAssignment([a(1, 0), a(2, 600)], at(590)).id).toBe(2);
      expect(attendanceService.pickAssignment([a(1, 0), a(2, 600)], at(20)).id).toBe(1);
      expect(attendanceService.pickAssignment([], at(0))).toBeNull();
    });

    it('is PRESENT up to and including the grace period, LATE after it', () => {
      const assignment = a(1, 0);
      const status = (m) => attendanceService.statusForClockIn({ clockIn: at(m), assignment, graceMinutes: 10 });
      expect(status(-30)).toBe('PRESENT'); // early
      expect(status(0)).toBe('PRESENT');
      expect(status(10)).toBe('PRESENT'); // exactly at the grace boundary
      expect(status(11)).toBe('LATE');
      expect(status(240)).toBe('LATE');
    });

    it('treats zero grace as strict', () => {
      const assignment = a(1, 0);
      expect(attendanceService.statusForClockIn({ clockIn: at(0), assignment, graceMinutes: 0 })).toBe('PRESENT');
      expect(attendanceService.statusForClockIn({ clockIn: at(1), assignment, graceMinutes: 0 })).toBe('LATE');
    });

    it('is PRESENT when there is no roster entry to be late for', () => {
      expect(attendanceService.statusForClockIn({ clockIn: at(999), assignment: null, graceMinutes: 10 })).toBe('PRESENT');
    });
  });
});

describe('attendance.service — timezoneForBranch', () => {
  it('defaults to Asia/Ho_Chi_Minh and honours a branch override', async () => {
    expect(await attendanceService.timezoneForBranch(1)).toBe('Asia/Ho_Chi_Minh');
    await systemConfigService.setValue({ key: 'ATTENDANCE_TIMEZONE', branchId: 1, value: 'Asia/Bangkok', accountId: 1 });
    expect(await attendanceService.timezoneForBranch(1)).toBe('Asia/Bangkok');
    expect(await attendanceService.timezoneForBranch(2)).toBe('Asia/Ho_Chi_Minh');
  });

  it('cannot be configured with a timezone that does not exist', async () => {
    await expect(
      systemConfigService.setValue({ key: 'ATTENDANCE_TIMEZONE', branchId: 1, value: 'Mars/Olympus', accountId: 1 }),
    ).rejects.toThrow('validation failed');
    await expect(
      systemConfigService.setValue({ key: 'ATTENDANCE_TIMEZONE', branchId: 1, value: '+07:00', accountId: 1 }),
    ).rejects.toThrow('validation failed');
  });

  it('exposes a numeric late grace with bounds', async () => {
    expect(await attendanceService.lateGraceMinutes(1)).toBe(10);
    await expect(
      systemConfigService.setValue({ key: 'ATTENDANCE_LATE_GRACE', branchId: 1, value: 500, accountId: 1 }),
    ).rejects.toThrow('validation failed');
  });
});

describe('attendance.service — markAbsentees', () => {
  const NOW = new Date('2026-09-26T12:00:00Z');
  const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600000);

  async function seedEmployee(id, overrides = {}) {
    return Employee.create({
      id,
      user_id: 100 + id,
      branch_id: 1,
      employee_code: `EMP-${id}`,
      position_id: 1,
      status: 1,
      ...overrides,
    });
  }

  function assignmentFields(overrides = {}) {
    return {
      id: 1,
      employee_id: 1,
      shift_id: 1,
      branch_id: 1,
      date: '2026-09-26',
      start_at: hoursAgo(6),
      end_at: hoursAgo(1),
      status: 'ACTIVE',
      ...overrides,
    };
  }

  it('flags an ended shift with no attendance as ABSENT, with a system audit row', async () => {
    await seedEmployee(1);
    await ShiftAssignment.create(assignmentFields());

    expect(await attendanceService.markAbsentees(NOW)).toBe(1);

    const row = await Attendance.findOne({ employee_id: 1 });
    expect(row).toMatchObject({ status: 'ABSENT', work_date: '2026-09-26', branch_id: 1, shift_assignment_id: 1 });
    expect(row.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(row.clock_in).toBeNull();

    const audit = await AuditLog.findOne({ action: 'ATTENDANCE_AUTO_ABSENT' });
    expect(audit).toMatchObject({ entity_type: 'ATTENDANCE', entity_id: row.id, branch_id: 1, performed_by: null });
  });

  it('is idempotent', async () => {
    await seedEmployee(1);
    await ShiftAssignment.create(assignmentFields());
    expect(await attendanceService.markAbsentees(NOW)).toBe(1);
    expect(await attendanceService.markAbsentees(NOW)).toBe(0);
    expect(await Attendance.countDocuments()).toBe(1);
  });

  it('leaves an employee who clocked in alone', async () => {
    await seedEmployee(1);
    await ShiftAssignment.create(assignmentFields());
    await Attendance.create({
      id: 9,
      employee_id: 1,
      branch_id: 1,
      work_date: '2026-09-26',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'PRESENT',
      clock_in: hoursAgo(5),
    });
    expect(await attendanceService.markAbsentees(NOW)).toBe(0);
    expect((await Attendance.findOne({ id: 9 })).status).toBe('PRESENT');
  });

  it('counts a clock-in that landed on the neighbouring work date as turning up', async () => {
    await seedEmployee(1);
    await ShiftAssignment.create(assignmentFields());
    await Attendance.create({
      id: 9,
      employee_id: 1,
      branch_id: 1,
      work_date: '2026-09-25',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'PRESENT',
      clock_in: hoursAgo(6.5),
    });
    expect(await attendanceService.markAbsentees(NOW)).toBe(0);
  });

  it('does not overwrite a day a manager already marked ON_LEAVE', async () => {
    await seedEmployee(1);
    await ShiftAssignment.create(assignmentFields());
    await Attendance.create({
      id: 9,
      employee_id: 1,
      branch_id: 1,
      work_date: '2026-09-26',
      timezone: 'Asia/Ho_Chi_Minh',
      status: 'ON_LEAVE',
    });
    expect(await attendanceService.markAbsentees(NOW)).toBe(0);
    expect((await Attendance.findOne({ id: 9 })).status).toBe('ON_LEAVE');
  });

  it('ignores shifts still running, cancelled ones, inactive employees, and ancient history', async () => {
    await seedEmployee(1);
    await seedEmployee(2, { status: 0 });
    await seedEmployee(3);
    await seedEmployee(4);
    await ShiftAssignment.create([
      assignmentFields({ id: 1, employee_id: 1, end_at: new Date(NOW.getTime() + 3600000) }), // not over
      assignmentFields({ id: 2, employee_id: 2 }), // inactive employee
      assignmentFields({ id: 3, employee_id: 3, status: 'CANCELLED' }),
      assignmentFields({ id: 4, employee_id: 4, date: '2026-08-01', start_at: hoursAgo(24 * 50), end_at: hoursAgo(24 * 50 - 5) }),
    ]);
    expect(await attendanceService.markAbsentees(NOW)).toBe(0);
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it('writes one ABSENT row when an employee had two ended assignments on the same day', async () => {
    await seedEmployee(1);
    await ShiftAssignment.create([
      assignmentFields({ id: 1, shift_id: 1 }),
      assignmentFields({ id: 2, shift_id: 2, start_at: hoursAgo(9), end_at: hoursAgo(7) }),
    ]);
    expect(await attendanceService.markAbsentees(NOW)).toBe(1);
    expect(await Attendance.countDocuments()).toBe(1);
  });
});

describe('attendance.service — realtime broadcast', () => {
  const socket = require('../utils/socket');
  const Branch = require('../models/Branch');
  const { REALTIME_EVENT } = require('../utils/realtimeEvents');

  async function seedBranchAndEmployees() {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Employee.create([
      { id: 1, user_id: 7, branch_id: 1, employee_code: 'E1', position_id: 1, status: 1 },
      { id: 2, user_id: 8, branch_id: 1, employee_code: 'E2', position_id: 1, status: 1 },
    ]);
  }

  const row = (overrides = {}) => ({
    id: 5,
    employee_id: 1,
    branch_id: 1,
    work_date: '2026-09-26',
    status: 'LATE',
    clock_in: new Date('2026-09-26T01:00:00Z'),
    clock_out: null,
    break_start: null,
    break_end: null,
    ...overrides,
  });

  beforeEach(() => jest.clearAllMocks());

  it('tells the employee it is about, that branch’s admin, and super admin — and nobody else', async () => {
    await seedBranchAndEmployees();
    await attendanceService.broadcast(row(), 'UPDATED');

    const event = REALTIME_EVENT.ATTENDANCE_UPDATED;
    expect(socket.emitToAccount).toHaveBeenCalledTimes(1);
    expect(socket.emitToAccount).toHaveBeenCalledWith(7, event, expect.objectContaining({ employeeId: 1, status: 'LATE' }));
    expect(socket.emitToOwner).toHaveBeenCalledTimes(1);
    expect(socket.emitToOwner).toHaveBeenCalledWith(42, event, expect.objectContaining({ branchId: 1, sessionState: 'WORKING' }));
    expect(socket.emitToAdmin).toHaveBeenCalledTimes(1);
  });

  it('never uses the branch room, which every colleague of the employee is in', async () => {
    await seedBranchAndEmployees();
    await attendanceService.broadcast(row(), 'UPDATED');
    expect(socket.emitToBranch).not.toHaveBeenCalled();
    expect(socket.emitBranchEvent).not.toHaveBeenCalled();
    expect(socket.emitPublic).not.toHaveBeenCalled();
    expect(socket.emitToStaff).not.toHaveBeenCalled();
  });

  it('does not address a colleague’s account room', async () => {
    await seedBranchAndEmployees();
    await attendanceService.broadcast(row({ employee_id: 1 }), 'UPDATED');
    const accountIds = socket.emitToAccount.mock.calls.map((call) => call[0]);
    expect(accountIds).toEqual([7]);
    expect(accountIds).not.toContain(8);
  });

  it('carries only what the list already shows — no note, no timestamps', async () => {
    await seedBranchAndEmployees();
    await attendanceService.broadcast(row({ note: 'private reason' }), 'CREATED');
    const payload = socket.emitToAdmin.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(
      ['action', 'branchId', 'employeeId', 'id', 'sessionState', 'status', 'workDate'].sort(),
    );
  });

  it('never throws — a failed lookup must not fail a clock action', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const employeeRepository = require('../repositories/employee.repository');
    const spy = jest.spyOn(employeeRepository, 'findById').mockRejectedValueOnce(new Error('db down'));
    await expect(attendanceService.broadcast(row(), 'UPDATED')).resolves.toBeUndefined();
    expect(socket.emitToAdmin).not.toHaveBeenCalled();
    spy.mockRestore();
    errorSpy.mockRestore();
  });

  it('is emitted for an automatic absence too', async () => {
    await seedBranchAndEmployees();
    const NOW = new Date('2026-09-26T12:00:00Z');
    await ShiftAssignment.create({
      id: 1,
      employee_id: 2,
      shift_id: 1,
      branch_id: 1,
      date: '2026-09-26',
      start_at: new Date(NOW.getTime() - 6 * 3600000),
      end_at: new Date(NOW.getTime() - 3600000),
      status: 'ACTIVE',
    });
    expect(await attendanceService.markAbsentees(NOW)).toBe(1);
    expect(socket.emitToAccount).toHaveBeenCalledWith(8, REALTIME_EVENT.ATTENDANCE_UPDATED, expect.objectContaining({ status: 'ABSENT', action: 'CREATED' }));
    expect(socket.emitToOwner).toHaveBeenCalledWith(42, REALTIME_EVENT.ATTENDANCE_UPDATED, expect.anything());
  });
});
