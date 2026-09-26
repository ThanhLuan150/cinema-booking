jest.mock('../utils/socket');

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const employeeRoutes = require('./employee.routes');
const socket = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

const app = buildTestApp('/api/employee', employeeRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  jest.clearAllMocks();
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER = 42;
const ownerAuth = () => authHeader({ role: 2, accountId: OWNER });

// Employee 1 (account 7) is the one being managed; employee 2 (account 8) is a colleague at the
// same branch who must not hear about it. Branch 2 belongs to someone else.
async function seedWorld() {
  const cashier = await Position.findOne({ code: 'CASHIER' });
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER, name: 'A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
  ]);
  await Account.create([
    { id: 7, email: 'e7@t.local', password: 'x', name: 'Seven', role: 3, verified: true },
    { id: 8, email: 'e8@t.local', password: 'x', name: 'Eight', role: 3, verified: true },
  ]);
  await Employee.create([
    { id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-1', position_id: cashier.id, status: 1 },
    { id: 2, user_id: 8, branch_id: 1, employee_code: 'EMP-2', position_id: cashier.id, status: 1 },
  ]);
  return { cashier, security: await Position.findOne({ code: 'SECURITY' }) };
}

const EVENT = REALTIME_EVENT.EMPLOYEE_UPDATED;

// Calls of an emit helper that carried the employee event. The audit log emits its own
// `auditLog:new` through some of the same helpers, which is not what is under test here.
const employeeCalls = (fn) => fn.mock.calls.filter((call) => call.includes(EVENT));

describe('employee position/status changes — realtime audience', () => {
  it('tells the employee, their branch admin and super admin when the position changes', async () => {
    const { security } = await seedWorld();
    const res = await request(app).put('/api/employee/1').set('Authorization', ownerAuth()).send({ position_id: security.id });
    expect(res.status).toBe(200);

    expect(employeeCalls(socket.emitToAccount)).toHaveLength(1);
    expect(socket.emitToAccount).toHaveBeenCalledWith(
      7,
      EVENT,
      expect.objectContaining({ action: 'UPDATED', id: 1, positionId: security.id, status: 1, branchId: 1 }),
    );
    expect(employeeCalls(socket.emitToOwner)).toHaveLength(1);
    expect(socket.emitToOwner).toHaveBeenCalledWith(OWNER, EVENT, expect.objectContaining({ id: 1 }));
    expect(employeeCalls(socket.emitToAdmin)).toHaveLength(1);
    expect(socket.emitToAdmin).toHaveBeenCalledWith(EVENT, expect.objectContaining({ id: 1 }));
  });

  it('does not use the branch room, so a colleague never hears who was moved', async () => {
    const { security } = await seedWorld();
    await request(app).put('/api/employee/1').set('Authorization', ownerAuth()).send({ position_id: security.id });

    for (const helper of [socket.emitToBranch, socket.emitBranchEvent, socket.emitPublic, socket.emitToStaff]) {
      expect(employeeCalls(helper)).toHaveLength(0);
    }
    expect(employeeCalls(socket.emitToAccount).map((c) => c[0])).toEqual([7]);
  });

  it('carries only ids and flags — never the email, name or phone', async () => {
    const { security } = await seedWorld();
    await request(app).put('/api/employee/1').set('Authorization', ownerAuth()).send({ position_id: security.id });
    const payload = employeeCalls(socket.emitToAccount)[0][2];
    expect(Object.keys(payload).sort()).toEqual(['action', 'branchId', 'id', 'positionId', 'status'].sort());
  });

  it('announces a deactivation (status change) to the same audiences', async () => {
    await seedWorld();
    const res = await request(app).delete('/api/employee/1').set('Authorization', ownerAuth());
    expect(res.status).toBe(200);
    expect(socket.emitToAccount).toHaveBeenCalledWith(7, EVENT, expect.objectContaining({ action: 'STATUS_CHANGED', status: 0 }));
    expect(socket.emitToOwner).toHaveBeenCalledWith(OWNER, EVENT, expect.anything());
    expect(employeeCalls(socket.emitToAdmin)).toHaveLength(1);
    expect(employeeCalls(socket.emitToBranch)).toHaveLength(0);
  });

  it('says nothing when the change is rejected', async () => {
    await seedWorld();
    const res = await request(app).put('/api/employee/1').set('Authorization', ownerAuth()).send({ position_id: 99999 });
    expect(res.status).toBe(400);
    for (const helper of [socket.emitToAccount, socket.emitToOwner, socket.emitToAdmin]) {
      expect(employeeCalls(helper)).toHaveLength(0);
    }
  });

  it('does not let a failed broadcast undo or fail the saved change', async () => {
    const { security } = await seedWorld();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    socket.emitToAccount.mockImplementationOnce(() => {
      throw new Error('socket down');
    });
    const res = await request(app).put('/api/employee/1').set('Authorization', ownerAuth()).send({ position_id: security.id });
    expect(res.status).toBe(200);
    expect((await Employee.findOne({ id: 1 })).position_id).toBe(security.id);
    errorSpy.mockRestore();
  });
});
