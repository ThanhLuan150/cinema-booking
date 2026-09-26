const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const attendanceRoutes = require('./attendance.routes');
const systemConfigService = require('../services/systemConfig.service');
const { workDateFor } = require('../utils/attendanceTime');
const Account = require('../models/Account');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const Branch = require('../models/Branch');
const Counter = require('../models/Counter');
const Employee = require('../models/Employee');
const ShiftAssignment = require('../models/ShiftAssignment');

const app = buildTestApp('/api/attendance', attendanceRoutes);

beforeAll(async () => {
  await connect();
  await Attendance.init();
});
beforeEach(async () => {
  systemConfigService.invalidateAll();
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42;
const OWNER_B = 99;
const adminAuth = () => authHeader({ role: 0, accountId: 1 });
const ownerAAuth = () => authHeader({ role: 2, accountId: OWNER_A });
const ownerBAuth = () => authHeader({ role: 2, accountId: OWNER_B });
const customerAuth = () => authHeader({ role: 1, accountId: 5 });
// Employee 1 and 2 work at branch 1, employee 3 at branch 2, employee 4 is deactivated.
const emp1 = () => authHeader({ role: 3, accountId: 7 });
const emp2 = () => authHeader({ role: 3, accountId: 8 });
const emp3 = () => authHeader({ role: 3, accountId: 9 });
const emp4 = () => authHeader({ role: 3, accountId: 10 });

const MINUTE = 60000;

async function seedWorld() {
  // Rows inserted by hand below use small ids; start the API's id counter well clear of them.
  await Counter.create({ name: 'attendance', seq: 1000 });
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
  await Employee.create([
    { id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-1', position_id: 1, status: 1 },
    { id: 2, user_id: 8, branch_id: 1, employee_code: 'EMP-2', position_id: 1, status: 1 },
    { id: 3, user_id: 9, branch_id: 2, employee_code: 'EMP-3', position_id: 1, status: 1 },
    { id: 4, user_id: 10, branch_id: 1, employee_code: 'EMP-4', position_id: 1, status: 0 },
  ]);
}

// A work day computed independently of the code under test: `offsetHours` is a fixed-offset zone
// (Asia/Ho_Chi_Minh is +7 all year, Pacific/Pago_Pago is -11), so shifting the instant and
// reading its UTC date is an oracle that shares nothing with Intl-based workDateFor.
const oracleDate = (offsetHours) => new Date(Date.now() + offsetHours * 3600000).toISOString().slice(0, 10);
function expectWorkDate(actual, offsetHours, before) {
  expect([before, oracleDate(offsetHours)]).toContain(actual);
}

function rowFields(overrides = {}) {
  return {
    id: 1,
    employee_id: 1,
    branch_id: 1,
    work_date: '2026-09-20',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'PRESENT',
    clock_in: new Date('2026-09-20T01:00:00Z'),
    clock_out: new Date('2026-09-20T09:00:00Z'),
    ...overrides,
  };
}

async function assignShift(employeeId, { startsInMinutes, endsInMinutes = startsInMinutes + 480, id = 1, branchId = 1 } = {}) {
  const now = Date.now();
  return ShiftAssignment.create({
    id,
    employee_id: employeeId,
    shift_id: 1,
    branch_id: branchId,
    date: workDateFor(new Date(), 'Asia/Ho_Chi_Minh'),
    start_at: new Date(now + startsInMinutes * MINUTE),
    end_at: new Date(now + endsInMinutes * MINUTE),
  });
}

const post = (path, auth, body = {}) => request(app).post(`/api/attendance${path}`).set('Authorization', auth).send(body);
const get = (path, auth) => request(app).get(`/api/attendance${path}`).set('Authorization', auth);

describe('attendance.routes — access control', () => {
  it('requires auth on every endpoint', async () => {
    const calls = [
      request(app).get('/api/attendance/today'),
      request(app).post('/api/attendance/clock-in'),
      request(app).post('/api/attendance/break/start'),
      request(app).post('/api/attendance/break/end'),
      request(app).post('/api/attendance/clock-out'),
      request(app).get('/api/attendance'),
      request(app).get('/api/attendance/me'),
      request(app).get('/api/attendance/1'),
      request(app).post('/api/attendance/mark'),
      request(app).patch('/api/attendance/1/close'),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
  });

  it('forbids a customer everywhere', async () => {
    await seedWorld();
    for (const res of [
      await get('/today', customerAuth()),
      await post('/clock-in', customerAuth()),
      await get('/', customerAuth()),
      await get('/me', customerAuth()),
      await post('/mark', customerAuth(), { employee_id: 1, work_date: '2026-09-20', status: 'ABSENT' }),
    ]) {
      expect(res.status).toBe(403);
    }
  });

  it('does not let a branch admin clock in — they have no employee record to clock', async () => {
    await seedWorld();
    expect((await post('/clock-in', ownerAAuth())).status).toBe(403);
  });

  it('refuses a super admin who is not an employee, rather than clocking in as nobody', async () => {
    await seedWorld();
    const res = await post('/clock-in', adminAuth());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ATTENDANCE_NOT_EMPLOYEE');
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it('refuses a deactivated employee', async () => {
    await seedWorld();
    const res = await post('/clock-in', emp4());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMPLOYEE_NOT_ACTIVE');
  });

  it('does not let an employee use the manager actions', async () => {
    await seedWorld();
    await Attendance.create(rowFields({ clock_out: null }));
    expect((await post('/mark', emp1(), { employee_id: 2, work_date: '2026-09-20', status: 'ABSENT' })).status).toBe(403);
    const close = await request(app)
      .patch('/api/attendance/1/close')
      .set('Authorization', emp1())
      .send({ clock_out: '2026-09-20T09:00:00Z', note: 'x' });
    expect(close.status).toBe(403);
  });
});

describe('attendance.routes — clock in / break / resume / clock out', () => {
  it('clocks in for the caller, using server time and the branch-local work day', async () => {
    await seedWorld();
    const before = oracleDate(7);
    const sentAt = Date.now();

    // A client cannot backdate itself or pick another employee: those fields are simply ignored.
    const res = await post('/clock-in', emp1(), {
      clock_in: '2000-01-01T00:00:00Z',
      work_date: '2000-01-01',
      employee_id: 2,
      branch_id: 2,
      status: 'LATE',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      employee_id: 1,
      branch_id: 1,
      status: 'PRESENT',
      timezone: 'Asia/Ho_Chi_Minh',
      session_state: 'WORKING',
      clock_out: null,
    });
    expectWorkDate(res.body.work_date, 7, before);
    expect(Math.abs(new Date(res.body.clock_in).getTime() - sentAt)).toBeLessThan(10000);
    expect(await Attendance.countDocuments()).toBe(1);
  });

  it('runs the whole Clock In -> Break -> Resume -> Clock Out flow', async () => {
    await seedWorld();

    expect((await post('/clock-in', emp1())).status).toBe(201);
    const working = await get('/today', emp1());
    expect(working.body.session_state).toBe('WORKING');

    const onBreak = await post('/break/start', emp1());
    expect(onBreak.status).toBe(200);
    expect(onBreak.body.session_state).toBe('ON_BREAK');
    expect(onBreak.body.break_start).toBeTruthy();
    expect((await get('/today', emp1())).body.session_state).toBe('ON_BREAK');

    const resumed = await post('/break/end', emp1());
    expect(resumed.status).toBe(200);
    expect(resumed.body.session_state).toBe('WORKING');
    expect(resumed.body.break_end).toBeTruthy();

    const out = await post('/clock-out', emp1());
    expect(out.status).toBe(200);
    expect(out.body.session_state).toBe('CLOCKED_OUT');
    expect(out.body.clock_out).toBeTruthy();

    const row = await Attendance.findOne({ employee_id: 1 });
    expect(row.clock_in <= row.break_start).toBe(true);
    expect(row.break_start <= row.break_end).toBe(true);
    expect(row.break_end <= row.clock_out).toBe(true);
  });

  it('rejects a second clock-in while a session is active', async () => {
    await seedWorld();
    await post('/clock-in', emp1());
    const again = await post('/clock-in', emp1());
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ACTIVE_SESSION_EXISTS');
    expect(again.body.attendance.session_state).toBe('WORKING');
    expect(await Attendance.countDocuments()).toBe(1);
  });

  it('rejects a clock-in while on a break, too', async () => {
    await seedWorld();
    await post('/clock-in', emp1());
    await post('/break/start', emp1());
    expect((await post('/clock-in', emp1())).body.code).toBe('ACTIVE_SESSION_EXISTS');
  });

  it('lets only one of two simultaneous clock-ins through', async () => {
    await seedWorld();
    const results = await Promise.all([post('/clock-in', emp1()), post('/clock-in', emp1())]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Attendance.countDocuments()).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'ATTENDANCE_CLOCK_IN' })).toBe(1);
  });

  it('rejects clock-out, break start and break end when not clocked in', async () => {
    await seedWorld();
    for (const path of ['/clock-out', '/break/start', '/break/end']) {
      const res = await post(path, emp1());
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('NOT_CLOCKED_IN');
    }
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it('rejects clock-out after the day is already complete, and a second clock-in that day', async () => {
    await seedWorld();
    await post('/clock-in', emp1());
    await post('/clock-out', emp1());

    const outAgain = await post('/clock-out', emp1());
    expect(outAgain.status).toBe(409);
    expect(outAgain.body.code).toBe('NOT_CLOCKED_IN');

    const inAgain = await post('/clock-in', emp1());
    expect(inAgain.status).toBe(409);
    expect(inAgain.body.code).toBe('ALREADY_CLOCKED_OUT');
    expect(await Attendance.countDocuments()).toBe(1);
  });

  it('enforces the break rules: no double break, no clock-out mid-break, one break a day', async () => {
    await seedWorld();
    await post('/clock-in', emp1());
    await post('/break/start', emp1());

    expect((await post('/break/start', emp1())).body.code).toBe('ALREADY_ON_BREAK');
    const midBreakOut = await post('/clock-out', emp1());
    expect(midBreakOut.status).toBe(409);
    expect(midBreakOut.body.code).toBe('ON_BREAK');
    expect((await Attendance.findOne({ employee_id: 1 })).clock_out).toBeNull();

    await post('/break/end', emp1());
    expect((await post('/break/end', emp1())).body.code).toBe('NOT_ON_BREAK');
    expect((await post('/break/start', emp1())).body.code).toBe('BREAK_ALREADY_TAKEN');
  });

  it('keeps one employee’s clock separate from another’s', async () => {
    await seedWorld();
    await post('/clock-in', emp1());
    expect((await post('/clock-out', emp2())).body.code).toBe('NOT_CLOCKED_IN');
    expect((await post('/clock-in', emp2())).status).toBe(201);
    expect((await post('/clock-in', emp3())).status).toBe(201);
    expect(await Attendance.countDocuments()).toBe(3);
  });

  it('shows "not started" on /today before any clock-in', async () => {
    await seedWorld();
    const res = await get('/today', emp1());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ session_state: 'NOT_STARTED', attendance: null, timezone: 'Asia/Ho_Chi_Minh' });
    expect(res.body.work_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a forgotten session from an earlier day still blocks clock-in, and can be clocked out of', async () => {
    await seedWorld();
    await Attendance.create(rowFields({ work_date: '2026-09-10', clock_in: new Date('2026-09-10T01:00:00Z'), clock_out: null }));

    const blocked = await post('/clock-in', emp1());
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('ACTIVE_SESSION_EXISTS');
    expect((await get('/today', emp1())).body.attendance.work_date).toBe('2026-09-10');

    const out = await post('/clock-out', emp1());
    expect(out.status).toBe(200);
    expect(out.body.work_date).toBe('2026-09-10');
    expect((await post('/clock-in', emp1())).status).toBe(201);
  });
});

describe('attendance.routes — PRESENT vs LATE', () => {
  it('is PRESENT with no roster entry', async () => {
    await seedWorld();
    expect((await post('/clock-in', emp1())).body).toMatchObject({ status: 'PRESENT', shift_assignment_id: null });
  });

  it('is PRESENT before the shift starts and within the grace period', async () => {
    await seedWorld();
    await assignShift(1, { startsInMinutes: 30 });
    expect((await post('/clock-in', emp1())).body).toMatchObject({ status: 'PRESENT', shift_assignment_id: 1 });

    await assignShift(2, { startsInMinutes: -5, id: 2 });
    expect((await post('/clock-in', emp2())).body.status).toBe('PRESENT');
  });

  it('is LATE once past the grace period', async () => {
    await seedWorld();
    await assignShift(1, { startsInMinutes: -45 });
    const res = await post('/clock-in', emp1());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'LATE', shift_assignment_id: 1 });
  });

  it('follows the branch-configured grace period', async () => {
    await seedWorld();
    await systemConfigService.setValue({ key: 'ATTENDANCE_LATE_GRACE', branchId: 1, value: 60, accountId: 1 });
    await assignShift(1, { startsInMinutes: -45 });
    expect((await post('/clock-in', emp1())).body.status).toBe('PRESENT');
  });

  it('ignores a cancelled assignment and another branch’s roster', async () => {
    await seedWorld();
    await ShiftAssignment.create({
      id: 1,
      employee_id: 1,
      shift_id: 1,
      branch_id: 1,
      date: workDateFor(new Date(), 'Asia/Ho_Chi_Minh'),
      start_at: new Date(Date.now() - 120 * MINUTE),
      end_at: new Date(Date.now() + 120 * MINUTE),
      status: 'CANCELLED',
    });
    await assignShift(3, { startsInMinutes: -120, id: 2, branchId: 2 });
    expect((await post('/clock-in', emp1())).body).toMatchObject({ status: 'PRESENT', shift_assignment_id: null });
  });
});

describe('attendance.routes — timezone validation', () => {
  it('accepts a matching timezone from the client, in any case', async () => {
    await seedWorld();
    expect((await post('/clock-in', emp1(), { timezone: 'asia/ho_chi_minh' })).status).toBe(201);
  });

  it('rejects a timezone that does not exist', async () => {
    await seedWorld();
    for (const timezone of ['Mars/Olympus', '+07:00', 'ICT', 'Asia/Ho_Chi_Minh; drop', 7]) {
      const res = await post('/clock-in', emp1(), { timezone });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIMEZONE');
    }
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it('rejects a real timezone that is not the branch’s, and says which one is expected', async () => {
    await seedWorld();
    const res = await post('/clock-in', emp1(), { timezone: 'America/New_York' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'TIMEZONE_MISMATCH', expected: 'Asia/Ho_Chi_Minh' });
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it('validates the timezone on every clock action, not just clock-in', async () => {
    await seedWorld();
    await post('/clock-in', emp1());
    for (const path of ['/break/start', '/break/end', '/clock-out']) {
      const res = await post(path, emp1(), { timezone: 'Nowhere/Land' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIMEZONE');
    }
    expect((await Attendance.findOne({ employee_id: 1 })).break_start).toBeNull();
    expect((await Attendance.findOne({ employee_id: 1 })).clock_out).toBeNull();
  });

  it('cuts the work day in the branch’s configured zone, not the server’s', async () => {
    await seedWorld();
    await systemConfigService.setValue({ key: 'ATTENDANCE_TIMEZONE', branchId: 1, value: 'Pacific/Pago_Pago', accountId: 1 });
    const before = oracleDate(-11);
    const res = await post('/clock-in', emp1());
    expect(res.status).toBe(201);
    expect(res.body.timezone).toBe('Pacific/Pago_Pago');
    expectWorkDate(res.body.work_date, -11, before);

    // Branch 2 was not overridden, so its employees are still on Vietnam time.
    const other = await post('/clock-in', emp3());
    expect(other.body.timezone).toBe('Asia/Ho_Chi_Minh');
    // Vietnam is 18h ahead of Pago Pago, so the two branches are never on the same calendar day.
    expect(other.body.work_date).not.toBe(res.body.work_date);
  });

  it('now rejects the old branch zone once the branch has been reconfigured', async () => {
    await seedWorld();
    await systemConfigService.setValue({ key: 'ATTENDANCE_TIMEZONE', branchId: 1, value: 'Pacific/Pago_Pago', accountId: 1 });
    const res = await post('/clock-in', emp1(), { timezone: 'Asia/Ho_Chi_Minh' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'TIMEZONE_MISMATCH', expected: 'Pacific/Pago_Pago' });
  });
});

describe('attendance.routes — audit log', () => {
  it('records clock-in and clock-out, attributed to the employee’s account and branch', async () => {
    await seedWorld();
    await post('/clock-in', emp1());
    await post('/break/start', emp1());
    await post('/break/end', emp1());
    await post('/clock-out', emp1());

    const logs = await AuditLog.find({ entity_type: 'ATTENDANCE' }).sort({ id: 1 });
    expect(logs.map((l) => l.action)).toEqual(['ATTENDANCE_CLOCK_IN', 'ATTENDANCE_CLOCK_OUT']);
    for (const log of logs) {
      expect(log).toMatchObject({ performed_by: 7, branch_id: 1 });
    }
    expect(logs[0].metadata).toMatchObject({ employeeId: 1, status: 'PRESENT', timezone: 'Asia/Ho_Chi_Minh' });
    expect(logs[1].metadata).toMatchObject({ employeeId: 1, workedMinutes: expect.any(Number) });
  });

  it('writes nothing for a rejected attempt', async () => {
    await seedWorld();
    await post('/clock-out', emp1());
    await post('/clock-in', emp1(), { timezone: 'Nope/Nope' });
    expect(await AuditLog.countDocuments({ entity_type: 'ATTENDANCE' })).toBe(0);
  });
});

describe('attendance.routes — reading', () => {
  async function seedRows() {
    await seedWorld();
    await Attendance.create([
      rowFields({ id: 1, employee_id: 1, branch_id: 1, work_date: '2026-09-20' }),
      rowFields({ id: 2, employee_id: 1, branch_id: 1, work_date: '2026-09-21', status: 'LATE' }),
      rowFields({ id: 3, employee_id: 2, branch_id: 1, work_date: '2026-09-20' }),
      rowFields({ id: 4, employee_id: 3, branch_id: 2, work_date: '2026-09-20' }),
      rowFields({ id: 5, employee_id: 2, branch_id: 1, work_date: '2026-09-22', status: 'ABSENT', clock_in: null, clock_out: null }),
    ]);
  }

  describe('as an employee', () => {
    it('sees only their own rows, newest first', async () => {
      await seedRows();
      const res = await get('/', emp1());
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.data.map((r) => r.id)).toEqual([2, 1]);
      expect(res.body.data.every((r) => r.employee_id === 1)).toBe(true);
    });

    it('cannot widen the query to a colleague or another branch', async () => {
      await seedRows();
      for (const query of ['?employeeId=2', '?branchId=1&employeeId=3', '?branchId=2']) {
        const res = await get(`/${query}`, emp1());
        expect(res.status).toBe(200);
        expect(res.body.data.every((r) => r.employee_id === 1)).toBe(true);
      }
    });

    it('/me returns the same own-only history', async () => {
      await seedRows();
      const res = await get('/me', emp2());
      expect(res.body.data.map((r) => r.id)).toEqual([5, 3]);
    });

    it('reads one of their own rows but gets a 404 — not a 403 — for anyone else’s', async () => {
      await seedRows();
      expect((await get('/1', emp1())).status).toBe(200);
      const theirs = await get('/3', emp1());
      expect(theirs.status).toBe(404);
      expect(theirs.body.code).toBe('ATTENDANCE_NOT_FOUND');
      expect((await get('/4', emp1())).status).toBe(404);
      expect((await get('/999', emp1())).status).toBe(404);
    });

    it('sees an empty page when they have no rows yet', async () => {
      await seedWorld();
      expect((await get('/me', emp1())).body).toMatchObject({ data: [], total: 0 });
    });
  });

  describe('as a branch admin', () => {
    it('must say which branch', async () => {
      await seedRows();
      expect((await get('/', ownerAAuth())).status).toBe(400);
    });

    it('sees every employee of their own branch and nothing from another', async () => {
      await seedRows();
      const res = await get('/?branchId=1', ownerAAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.map((r) => r.id).sort()).toEqual([1, 2, 3, 5]);
      expect(res.body.data.every((r) => r.branch_id === 1)).toBe(true);
    });

    it('is forbidden from listing or reading another branch', async () => {
      await seedRows();
      expect((await get('/?branchId=2', ownerAAuth())).status).toBe(403);
      expect((await get('/4', ownerAAuth())).status).toBe(403);
      expect((await get('/?branchId=1', ownerBAuth())).status).toBe(403);
      expect((await get('/4', ownerBAuth())).status).toBe(200);
    });

    it('cannot dodge the branch check by passing an employeeId from elsewhere', async () => {
      await seedRows();
      const res = await get('/?branchId=1&employeeId=3', ownerAAuth());
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    });

    it('filters by employee, status and date range', async () => {
      await seedRows();
      const byEmployee = await get('/?branchId=1&employeeId=2', ownerAAuth());
      expect(byEmployee.body.data.map((r) => r.id).sort()).toEqual([3, 5]);

      const byStatus = await get('/?branchId=1&status=LATE', ownerAAuth());
      expect(byStatus.body.data.map((r) => r.id)).toEqual([2]);

      const byRange = await get('/?branchId=1&from=2026-09-21&to=2026-09-22', ownerAAuth());
      expect(byRange.body.data.map((r) => r.id).sort()).toEqual([2, 5]);

      const oneDay = await get('/?branchId=1&from=2026-09-20&to=2026-09-20', ownerAAuth());
      expect(oneDay.body.data.map((r) => r.id).sort()).toEqual([1, 3]);
    });

    it('paginates', async () => {
      await seedRows();
      const res = await get('/?branchId=1&limit=2&page=2', ownerAAuth());
      expect(res.body).toMatchObject({ total: 4, page: 2, limit: 2, totalPages: 2 });
      expect(res.body.data).toHaveLength(2);
    });

    it('includes who the row belongs to and the derived worked time', async () => {
      await seedRows();
      await Account.create({ id: 7, email: 'one@example.com', password: 'x', name: 'Employee One', role: 3 });
      const res = await get('/?branchId=1&employeeId=1&limit=1', ownerAAuth());
      expect(res.body.data[0]).toMatchObject({
        employee: { id: 1, employee_code: 'EMP-1', name: 'Employee One', email: 'one@example.com' },
        session_state: 'CLOCKED_OUT',
        worked_minutes: 480,
      });
    });
  });

  describe('as the super admin', () => {
    it('sees every branch without naming one', async () => {
      await seedRows();
      const res = await get('/', adminAuth());
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5);
    });

    it('can narrow to one branch or one employee', async () => {
      await seedRows();
      expect((await get('/?branchId=2', adminAuth())).body.data.map((r) => r.id)).toEqual([4]);
      expect((await get('/?employeeId=1', adminAuth())).body.total).toBe(2);
      expect((await get('/4', adminAuth())).status).toBe(200);
    });
  });

  describe('query validation', () => {
    it('rejects malformed dates, reversed ranges and unknown statuses', async () => {
      await seedRows();
      const cases = [
        ['?branchId=1&from=2026-02-30', 'INVALID_DATE'],
        ['?branchId=1&to=yesterday', 'INVALID_DATE'],
        ['?branchId=1&from=2026-09-22&to=2026-09-20', 'INVALID_DATE_RANGE'],
        ['?branchId=1&status=HOLIDAY', 'INVALID_STATUS'],
      ];
      for (const [query, code] of cases) {
        const res = await get(`/${query}`, ownerAAuth());
        expect(res.status).toBe(400);
        expect(res.body.code).toBe(code);
      }
      expect((await get('/me?from=nope', emp1())).status).toBe(400);
    });
  });
});

describe('attendance.routes — POST /mark', () => {
  const markBody = (overrides = {}) => ({ employee_id: 1, work_date: '2026-09-20', status: 'ABSENT', note: 'No show', ...overrides });

  it('lets the branch admin mark an employee of their branch absent, and audits it with the reason', async () => {
    await seedWorld();
    const res = await post('/mark', ownerAAuth(), markBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      employee_id: 1,
      branch_id: 1,
      work_date: '2026-09-20',
      status: 'ABSENT',
      note: 'No show',
      recorded_by: OWNER_A,
      clock_in: null,
      session_state: 'NOT_STARTED',
    });

    const log = await AuditLog.findOne({ action: 'ATTENDANCE_MARKED' });
    expect(log).toMatchObject({ entity_id: res.body.id, branch_id: 1, performed_by: OWNER_A, reason: 'No show' });
    expect(log.metadata).toMatchObject({ employeeId: 1, workDate: '2026-09-20', status: 'ABSENT', previousStatus: null });
  });

  it('lets the super admin mark any branch', async () => {
    await seedWorld();
    expect((await post('/mark', adminAuth(), markBody({ employee_id: 3, status: 'ON_LEAVE' }))).status).toBe(201);
  });

  it('is forbidden across branches', async () => {
    await seedWorld();
    expect((await post('/mark', ownerBAuth(), markBody({ employee_id: 1 }))).status).toBe(403);
    expect((await post('/mark', ownerAAuth(), markBody({ employee_id: 3 }))).status).toBe(403);
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it('404s for an employee that does not exist', async () => {
    await seedWorld();
    expect((await post('/mark', ownerAAuth(), markBody({ employee_id: 999 }))).status).toBe(404);
  });

  it('only accepts ABSENT and ON_LEAVE — presence comes from the clock', async () => {
    await seedWorld();
    for (const status of ['PRESENT', 'LATE', 'nope', undefined]) {
      const res = await post('/mark', ownerAAuth(), markBody({ status }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS');
    }
  });

  it('rejects an impossible date', async () => {
    await seedWorld();
    for (const work_date of ['2026-02-30', '20/09/2026', '', undefined]) {
      expect((await post('/mark', ownerAAuth(), markBody({ work_date }))).body.code).toBe('INVALID_DATE');
    }
  });

  it('refuses a future ABSENT but allows future ON_LEAVE', async () => {
    await seedWorld();
    const future = oracleDate(7 + 24 * 5);
    const absent = await post('/mark', ownerAAuth(), markBody({ work_date: future }));
    expect(absent.status).toBe(400);
    expect(absent.body.code).toBe('FUTURE_DATE');
    expect((await post('/mark', ownerAAuth(), markBody({ work_date: future, status: 'ON_LEAVE' }))).status).toBe(201);
  });

  it('will not mark a deactivated employee', async () => {
    await seedWorld();
    expect((await post('/mark', ownerAAuth(), markBody({ employee_id: 4 }))).body.code).toBe('EMPLOYEE_NOT_ACTIVE');
  });

  it('switches an existing flag-only day between ABSENT and ON_LEAVE', async () => {
    await seedWorld();
    await post('/mark', ownerAAuth(), markBody());
    const res = await post('/mark', ownerAAuth(), markBody({ status: 'ON_LEAVE', note: 'Was sick' }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ON_LEAVE', note: 'Was sick' });
    expect(await Attendance.countDocuments()).toBe(1);
    const logs = await AuditLog.find({ action: 'ATTENDANCE_MARKED' }).sort({ id: 1 });
    expect(logs[1].metadata.previousStatus).toBe('ABSENT');
  });

  it('never replaces recorded working time', async () => {
    await seedWorld();
    await Attendance.create(rowFields());
    const res = await post('/mark', ownerAAuth(), markBody());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HAS_CLOCK_IN');
    expect((await Attendance.findOne({ id: 1 })).status).toBe('PRESENT');
  });

  it('blocks that employee from clocking in on a day marked ON_LEAVE', async () => {
    await seedWorld();
    const today = workDateFor(new Date(), 'Asia/Ho_Chi_Minh');
    await post('/mark', ownerAAuth(), markBody({ work_date: today, status: 'ON_LEAVE' }));
    const res = await post('/clock-in', emp1());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ATTENDANCE_ALREADY_RECORDED');
  });
});

describe('attendance.routes — PATCH /:id/close', () => {
  const openRow = (overrides = {}) =>
    rowFields({ work_date: '2026-09-10', clock_in: new Date('2026-09-10T01:00:00Z'), clock_out: null, ...overrides });
  const patch = (id, auth, body) => request(app).patch(`/api/attendance/${id}/close`).set('Authorization', auth).send(body);

  it('closes a forgotten session, records who and why, and audits it', async () => {
    await seedWorld();
    await Attendance.create(openRow());

    const res = await patch(1, ownerAAuth(), { clock_out: '2026-09-10T17:30:00+07:00', note: 'Forgot to clock out' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      session_state: 'CLOCKED_OUT',
      recorded_by: OWNER_A,
      note: 'Forgot to clock out',
      worked_minutes: 570,
    });
    expect(new Date(res.body.clock_out).toISOString()).toBe('2026-09-10T10:30:00.000Z');

    const log = await AuditLog.findOne({ action: 'ATTENDANCE_CORRECTED' });
    expect(log).toMatchObject({ entity_id: 1, branch_id: 1, performed_by: OWNER_A, reason: 'Forgot to clock out' });
    expect(log.metadata.clockOut).toBe('2026-09-10T10:30:00.000Z');
    // ...and the employee can clock in again.
    expect((await post('/clock-in', emp1())).status).toBe(201);
  });

  it('ends a break that was still running at the same moment', async () => {
    await seedWorld();
    await Attendance.create(openRow({ break_start: new Date('2026-09-10T05:00:00Z') }));
    const res = await patch(1, ownerAAuth(), { clock_out: '2026-09-10T06:00:00Z', note: 'Left on break' });
    expect(res.status).toBe(200);
    expect(res.body.break_minutes).toBe(60);
    expect(new Date(res.body.break_end).toISOString()).toBe('2026-09-10T06:00:00.000Z');
  });

  it('requires a reason', async () => {
    await seedWorld();
    await Attendance.create(openRow());
    for (const note of [undefined, '', '   ']) {
      const res = await patch(1, ownerAAuth(), { clock_out: '2026-09-10T10:00:00Z', note });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('REASON_REQUIRED');
    }
  });

  it('rejects a timestamp without an offset instead of guessing its timezone', async () => {
    await seedWorld();
    await Attendance.create(openRow());
    for (const clock_out of ['2026-09-10T17:30:00', '2026-09-10', 'yesterday', 12345, undefined]) {
      const res = await patch(1, ownerAAuth(), { clock_out, note: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TIMESTAMP');
    }
    expect((await Attendance.findOne({ id: 1 })).clock_out).toBeNull();
  });

  it('rejects a clock-out before the clock-in, in the future, or before the break began', async () => {
    await seedWorld();
    await Attendance.create(openRow({ break_start: new Date('2026-09-10T05:00:00Z') }));

    const before = await patch(1, ownerAAuth(), { clock_out: '2026-09-10T00:00:00Z', note: 'x' });
    expect(before.body.code).toBe('INVALID_TIME_RANGE');

    const beforeBreak = await patch(1, ownerAAuth(), { clock_out: '2026-09-10T04:00:00Z', note: 'x' });
    expect(beforeBreak.body.code).toBe('INVALID_TIME_RANGE');

    const future = new Date(Date.now() + 3600000).toISOString();
    expect((await patch(1, ownerAAuth(), { clock_out: future, note: 'x' })).body.code).toBe('FUTURE_TIMESTAMP');
  });

  it('will not touch a session that is already closed, or a flag-only row', async () => {
    await seedWorld();
    await Attendance.create([
      rowFields({ id: 1 }),
      rowFields({ id: 2, employee_id: 2, work_date: '2026-09-11', clock_in: null, clock_out: null, status: 'ABSENT' }),
    ]);
    for (const id of [1, 2]) {
      const res = await patch(id, ownerAAuth(), { clock_out: '2026-09-20T12:00:00Z', note: 'x' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SESSION_NOT_OPEN');
    }
    expect((await Attendance.findOne({ id: 1 })).clock_out).toEqual(new Date('2026-09-20T09:00:00Z'));
  });

  it('is scoped to the branch', async () => {
    await seedWorld();
    await Attendance.create(openRow());
    const body = { clock_out: '2026-09-10T10:00:00Z', note: 'x' };
    expect((await patch(1, ownerBAuth(), body)).status).toBe(403);
    expect((await patch(999, ownerAAuth(), body)).status).toBe(404);
    expect((await patch(1, adminAuth(), body)).status).toBe(200);
  });
});
