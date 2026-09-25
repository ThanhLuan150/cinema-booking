const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const attendanceRepository = require('./attendance.repository');
const Attendance = require('../models/Attendance');

beforeAll(async () => {
  await connect();
  await Attendance.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const T0 = new Date('2026-09-26T01:00:00Z');
const at = (minutes) => new Date(T0.getTime() + minutes * 60000);

function baseFields(overrides = {}) {
  return {
    id: 1,
    employee_id: 1,
    branch_id: 1,
    work_date: '2026-09-26',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'PRESENT',
    clock_in: T0,
    ...overrides,
  };
}

describe('attendance.repository', () => {
  describe('lookups', () => {
    it('findByEmployeeAndDate matches on both fields', async () => {
      await Attendance.create([
        baseFields(),
        baseFields({ id: 2, work_date: '2026-09-25' }),
        baseFields({ id: 3, employee_id: 2 }),
      ]);
      expect((await attendanceRepository.findByEmployeeAndDate(1, '2026-09-25')).id).toBe(2);
      expect(await attendanceRepository.findByEmployeeAndDate(1, '2026-01-01')).toBeNull();
    });

    it('findOpenSession finds a session on any day, and ignores closed rows and flag-only rows', async () => {
      await Attendance.create([
        baseFields({ id: 1, work_date: '2026-09-24', clock_out: at(480) }), // closed
        baseFields({ id: 2, work_date: '2026-09-25', clock_in: null, status: 'ABSENT' }), // no clock-in
        baseFields({ id: 3, work_date: '2026-09-23' }), // open, older
        baseFields({ id: 4, employee_id: 2 }), // someone else's
      ]);
      expect((await attendanceRepository.findOpenSession(1)).id).toBe(3);
      expect(await attendanceRepository.findOpenSession(9)).toBeNull();
    });

    it('findAll filters, sorts newest work_date first and paginates', async () => {
      await Attendance.create([
        baseFields({ id: 1, work_date: '2026-09-24' }),
        baseFields({ id: 2, work_date: '2026-09-26' }),
        baseFields({ id: 3, work_date: '2026-09-25' }),
        baseFields({ id: 4, work_date: '2026-09-26', branch_id: 2, employee_id: 2 }),
      ]);
      const page = await attendanceRepository.findAll({ branch_id: 1 }, { skip: 0, limit: 2 });
      expect(page.total).toBe(3);
      expect(page.data.map((r) => r.id)).toEqual([2, 3]);
    });
  });

  describe('existsForShiftWindow', () => {
    it('matches the work date or a clock-in inside the window', async () => {
      await Attendance.create(baseFields({ work_date: '2026-09-26', clock_in: at(0) }));
      // same work date, window elsewhere
      expect(await attendanceRepository.existsForShiftWindow(1, '2026-09-26', at(1000), at(2000))).toBeTruthy();
      // different date, but the clock-in falls inside the window
      expect(await attendanceRepository.existsForShiftWindow(1, '2026-09-27', at(-10), at(10))).toBeTruthy();
      // neither
      expect(await attendanceRepository.existsForShiftWindow(1, '2026-09-27', at(1000), at(2000))).toBeNull();
      expect(await attendanceRepository.existsForShiftWindow(2, '2026-09-26', at(-10), at(10))).toBeNull();
    });
  });

  describe('unique day guard', () => {
    it('rejects a second row for the same employee and day', async () => {
      await attendanceRepository.create(baseFields());
      await expect(attendanceRepository.create(baseFields({ id: 2 }))).rejects.toMatchObject({ code: 11000 });
    });
  });

  describe('startBreak / endBreak / clockOut guards', () => {
    it('walks the happy path in order', async () => {
      await Attendance.create(baseFields());
      expect((await attendanceRepository.startBreak(1, at(120))).break_start).toEqual(at(120));
      expect((await attendanceRepository.endBreak(1, at(150))).break_end).toEqual(at(150));
      expect((await attendanceRepository.clockOut(1, at(480))).clock_out).toEqual(at(480));
    });

    it('will not start a break before clock-in, after clock-out, or twice', async () => {
      await Attendance.create([
        baseFields({ id: 1, clock_in: null, status: 'ABSENT' }),
        baseFields({ id: 2, employee_id: 2, clock_out: at(480) }),
        baseFields({ id: 3, employee_id: 3, break_start: at(60) }),
      ]);
      expect(await attendanceRepository.startBreak(1, at(10))).toBeNull();
      expect(await attendanceRepository.startBreak(2, at(10))).toBeNull();
      expect(await attendanceRepository.startBreak(3, at(10))).toBeNull();
    });

    it('will not end a break that is not running', async () => {
      await Attendance.create([
        baseFields({ id: 1 }),
        baseFields({ id: 2, employee_id: 2, break_start: at(60), break_end: at(90) }),
      ]);
      expect(await attendanceRepository.endBreak(1, at(10))).toBeNull();
      expect(await attendanceRepository.endBreak(2, at(100))).toBeNull();
    });

    it('will not clock out while on a break, before clock-in, or twice', async () => {
      await Attendance.create([
        baseFields({ id: 1, break_start: at(60) }),
        baseFields({ id: 2, employee_id: 2, clock_in: null, status: 'ON_LEAVE' }),
        baseFields({ id: 3, employee_id: 3, clock_out: at(480) }),
      ]);
      expect(await attendanceRepository.clockOut(1, at(100))).toBeNull();
      expect(await attendanceRepository.clockOut(2, at(100))).toBeNull();
      expect(await attendanceRepository.clockOut(3, at(600))).toBeNull();
      expect((await Attendance.findOne({ id: 3 })).clock_out).toEqual(at(480)); // untouched
    });

    it('lets a clock-out through once the break has ended', async () => {
      await Attendance.create(baseFields({ break_start: at(60), break_end: at(90) }));
      expect(await attendanceRepository.clockOut(1, at(480))).not.toBeNull();
    });
  });

  describe('concurrency', () => {
    it('lets exactly one of several simultaneous clock-outs win', async () => {
      await Attendance.create(baseFields());
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => attendanceRepository.clockOut(1, at(480 + i))),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('lets exactly one of several simultaneous break starts win', async () => {
      await Attendance.create(baseFields());
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => attendanceRepository.startBreak(1, at(60 + i))),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('lets exactly one of several simultaneous inserts for the same day win', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) => attendanceRepository.create(baseFields({ id: i + 1 }))),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await Attendance.countDocuments()).toBe(1);
    });
  });

  describe('forceClose', () => {
    it('closes an open session, ends a running break, and records who and why', async () => {
      await Attendance.create(baseFields({ break_start: at(60) }));
      const row = await attendanceRepository.forceClose(1, {
        clockOut: at(300),
        breakEnd: at(300),
        note: 'forgot to clock out',
        recordedBy: 42,
      });
      expect(row.clock_out).toEqual(at(300));
      expect(row.break_end).toEqual(at(300));
      expect(row.note).toBe('forgot to clock out');
      expect(row.recorded_by).toBe(42);
    });

    it('refuses to overwrite a clock-out that already exists or a row with no clock-in', async () => {
      await Attendance.create([
        baseFields({ id: 1, clock_out: at(480) }),
        baseFields({ id: 2, employee_id: 2, clock_in: null, status: 'ABSENT' }),
      ]);
      expect(await attendanceRepository.forceClose(1, { clockOut: at(500) })).toBeNull();
      expect(await attendanceRepository.forceClose(2, { clockOut: at(500) })).toBeNull();
      expect((await Attendance.findOne({ id: 1 })).clock_out).toEqual(at(480));
    });
  });

  describe('overwriteMark', () => {
    it('re-flags a row that has no clock-in', async () => {
      await Attendance.create(baseFields({ clock_in: null, status: 'ABSENT' }));
      const row = await attendanceRepository.overwriteMark(1, { status: 'ON_LEAVE', note: 'sick', recordedBy: 42 });
      expect(row.status).toBe('ON_LEAVE');
      expect(row.recorded_by).toBe(42);
    });

    it('never replaces recorded working time', async () => {
      await Attendance.create(baseFields());
      expect(await attendanceRepository.overwriteMark(1, { status: 'ABSENT' })).toBeNull();
      expect((await Attendance.findOne({ id: 1 })).status).toBe('PRESENT');
    });
  });
});
