// Ticket 42 — Employee Position & Permission Management, exercised end to end at the HTTP layer
// with the real RBAC seed: who may assign a Position, who may never touch permissions or a
// SUPER_ADMIN, and that a Position's grants (and only those) reach the backend guards.
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { connect, closeDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const employeeRoutes = require('./employee.routes');
const positionRoutes = require('./position.routes');
const userRoutes = require('./user.routes');
const incidentRoutes = require('./incident.routes');
const inventoryRoutes = require('./inventory.routes');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Counter = require('../models/Counter');
const Inventory = require('../models/Inventory');
const Incident = require('../models/Incident');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/employee', employeeRoutes);
app.use('/api/position', positionRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api', userRoutes);
app.use((err, req, res, _next) => res.status(err.status || 500).json({ message: err.message }));

const SUPER_ADMIN_ID = 1;
const BRANCH_ADMIN_A = 42; // owns branch 1
const BRANCH_ADMIN_B = 99; // owns branch 2
const STAFF_ID = 60; // the employee whose position gets reassigned

const asSuperAdmin = () => authHeader({ role: 0, accountId: SUPER_ADMIN_ID });
const asAdminA = () => authHeader({ role: 2, accountId: BRANCH_ADMIN_A });
const asAdminB = () => authHeader({ role: 2, accountId: BRANCH_ADMIN_B });
const asEmployee = (accountId) => authHeader({ role: 3, accountId });

async function positionId(code) {
  return (await Position.findOne({ code })).id;
}

let nextEmployeeId = 1;
async function makeEmployee({ accountId, branchId = 1, positionCode, status = 1 }) {
  await Account.create({ id: accountId, email: `emp${accountId}@cinema.test`, password: 'hash', role: 3, status: 1 });
  const id = nextEmployeeId++;
  await Employee.create({
    id,
    user_id: accountId,
    branch_id: branchId,
    employee_code: `E${id}`,
    position_id: await positionId(positionCode),
    status,
  });
  return id;
}

// Seeding the RBAC tables is the slow part (hundreds of sequential writes), so it happens once
// per file; each test then only resets the data it creates. Roles, permissions and positions are
// read-only to these tests (the one that deactivates a Position restores it).
async function resetScenario(models) {
  for (const model of models) await model.deleteMany({});
  await Counter.deleteOne({ name: 'account' });
}

beforeAll(async () => {
  await connect();
  await seedRbac();
  await seedPositions();
});
beforeEach(async () => {
  nextEmployeeId = 1;
  // Hand-made fixture accounts use small ids; start the generated ones above them.
  await Counter.create({ name: 'account', seq: 1000 });
  await Branch.create([
    { id: 1, company_id: 1, owner_id: BRANCH_ADMIN_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: BRANCH_ADMIN_B, name: 'Branch B', code: 'B' },
  ]);
  await Account.create({ id: SUPER_ADMIN_ID, email: 'root@cinema.test', password: 'root-hash', role: 0, status: 1 });
});
afterEach(async () => resetScenario([Account, Branch, Employee, Inventory, Incident]));
afterAll(async () => closeDatabase());

describe('a Branch Admin assigns a Position', () => {
  it('changes an employee of their own branch to a new Position', async () => {
    const employeeId = await makeEmployee({ accountId: STAFF_ID, positionCode: 'USHER' });
    const res = await request(app)
      .put(`/api/employee/${employeeId}`)
      .set('Authorization', asAdminA())
      .send({ position_id: await positionId('CASHIER') });
    expect(res.status).toBe(200);
    expect(res.body.position.code).toBe('CASHIER');
    expect((await Employee.findOne({ id: employeeId })).position_id).toBe(await positionId('CASHIER'));
  });

  it('the new Position, and only it, governs the employee permissions on the very next request', async () => {
    const employeeId = await makeEmployee({ accountId: STAFF_ID, positionCode: 'USHER' });
    const permissionsOf = async () => {
      const res = await request(app).get('/api/user/permissions').set('Authorization', asEmployee(STAFF_ID));
      expect(res.status).toBe(200);
      return res.body;
    };

    const before = await permissionsOf();
    expect(before.positionCode).toBe('USHER');
    expect(before.permissions).toContain('ticket.checkin');
    expect(before.permissions).not.toContain('booking.create');

    await request(app)
      .put(`/api/employee/${employeeId}`)
      .set('Authorization', asAdminA())
      .send({ position_id: await positionId('CASHIER') });

    const after = await permissionsOf();
    expect(after.positionCode).toBe('CASHIER');
    expect(after.permissions).toEqual(expect.arrayContaining(['booking.create', 'payment.create', 'ticket.create']));
    expect(after.permissions).not.toContain('ticket.checkin');
  });

  it('cannot assign a Position to an employee of another branch', async () => {
    const employeeId = await makeEmployee({ accountId: STAFF_ID, branchId: 2, positionCode: 'USHER' });
    const res = await request(app)
      .put(`/api/employee/${employeeId}`)
      .set('Authorization', asAdminA())
      .send({ position_id: await positionId('CASHIER') });
    expect(res.status).toBe(403);
    expect((await Employee.findOne({ id: employeeId })).position_id).toBe(await positionId('USHER'));
  });

  it('cannot move an employee to another branch: branch_id/user_id in the body are ignored', async () => {
    const employeeId = await makeEmployee({ accountId: STAFF_ID, positionCode: 'USHER' });
    const res = await request(app)
      .put(`/api/employee/${employeeId}`)
      .set('Authorization', asAdminA())
      .send({ position_id: await positionId('CASHIER'), branch_id: 2, cinema_id: 2, user_id: 5 });
    expect(res.status).toBe(200);
    const stored = await Employee.findOne({ id: employeeId });
    expect(stored.branch_id).toBe(1);
    expect(stored.user_id).toBe(STAFF_ID);
  });

  it('rejects an unknown, inactive or malformed assignment', async () => {
    const employeeId = await makeEmployee({ accountId: STAFF_ID, positionCode: 'USHER' });
    const put = (body) => request(app).put(`/api/employee/${employeeId}`).set('Authorization', asAdminA()).send(body);

    expect((await put({ position_id: 999999 })).body.code).toBe('INVALID_POSITION');
    await Position.updateOne({ code: 'CASHIER' }, { $set: { status: 0 } });
    try {
      expect((await put({ position_id: await positionId('CASHIER') })).body.code).toBe('INVALID_POSITION');
    } finally {
      await Position.updateOne({ code: 'CASHIER' }, { $set: { status: 1 } });
    }
    expect((await put({ status: 7 })).body.code).toBe('INVALID_STATUS');
    expect((await put({})).status).toBe(400);
    expect((await Employee.findOne({ id: employeeId })).position_id).toBe(await positionId('USHER'));
  });

  it('deactivating locks the account and reactivating unlocks it again', async () => {
    const employeeId = await makeEmployee({ accountId: STAFF_ID, positionCode: 'USHER' });
    const put = (body) => request(app).put(`/api/employee/${employeeId}`).set('Authorization', asAdminA()).send(body);

    await put({ status: 0 });
    expect((await Account.findOne({ id: STAFF_ID })).status).toBe(0);
    await put({ status: 1 });
    expect((await Account.findOne({ id: STAFF_ID })).status).toBe(1);
  });

  it('a Super Admin may assign a Position in any branch', async () => {
    const employeeId = await makeEmployee({ accountId: STAFF_ID, branchId: 2, positionCode: 'USHER' });
    const res = await request(app)
      .put(`/api/employee/${employeeId}`)
      .set('Authorization', asSuperAdmin())
      .send({ position_id: await positionId('SECURITY') });
    expect(res.status).toBe(200);
  });

  it('creating an employee validates email and password and pins the verified branch', async () => {
    const post = (body) => request(app).post('/api/employee').set('Authorization', asAdminA()).send(body);
    const base = { cinema_id: 1, position_id: await positionId('USHER') };

    expect((await post({ ...base, email: 'not-an-email', password: 'secret123' })).body.code).toBe('INVALID_EMAIL');
    expect((await post({ ...base, email: 'ok@cinema.test', password: 'abc' })).body.code).toBe('PASSWORD_TOO_SHORT');
    expect((await post({ ...base, cinema_id: 2, email: 'ok@cinema.test', password: 'secret123' })).status).toBe(403);
    const created = await post({ ...base, email: 'ok@cinema.test', password: 'secret123' });
    expect(created.status).toBe(201);
    expect(created.body.branch_id).toBe(1);
  });
});

describe('an Employee can never change permissions', () => {
  const ALL_POSITIONS = [
    'TICKET_STAFF',
    'CASHIER',
    'CONCESSION_STAFF',
    'CHECK_IN_STAFF',
    'USHER',
    'CUSTOMER_SERVICE',
    'SECURITY',
    'FNB_STAFF',
    'CLEANING_STAFF',
    'MAINTENANCE_STAFF',
  ];

  it.each(ALL_POSITIONS)('%s is refused every employee-management and position endpoint', async (code) => {
    const selfId = await makeEmployee({ accountId: 70, positionCode: code });
    const otherId = await makeEmployee({ accountId: 71, positionCode: 'USHER' });
    const auth = asEmployee(70);
    const cashier = await positionId('CASHIER');

    const attempts = [
      request(app).put(`/api/employee/${selfId}`).set('Authorization', auth).send({ position_id: cashier }),
      request(app).put(`/api/employee/${otherId}`).set('Authorization', auth).send({ position_id: cashier }),
      request(app)
        .post('/api/employee')
        .set('Authorization', auth)
        .send({ cinema_id: 1, email: 'x@cinema.test', password: 'secret123', position_id: cashier }),
      request(app).delete(`/api/employee/${otherId}`).set('Authorization', auth),
      request(app).post(`/api/employee/${otherId}/reset-password`).set('Authorization', auth),
      request(app).get('/api/employee').query({ branchId: 1 }).set('Authorization', auth),
      request(app).get('/api/position').set('Authorization', auth),
      request(app).put('/api/users/70/role').set('Authorization', auth).send({ role: 0 }),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403);

    expect((await Employee.findOne({ id: selfId })).position_id).toBe(await positionId(code));
    expect((await Employee.findOne({ id: otherId })).position_id).toBe(await positionId('USHER'));
    expect((await Account.findOne({ id: 70 })).role).toBe(3);
  });

  it('a Customer is refused too', async () => {
    const res = await request(app)
      .put('/api/employee/1')
      .set('Authorization', authHeader({ role: 1, accountId: 5 }))
      .send({ position_id: 1 });
    expect(res.status).toBe(403);
  });

  it('the caller cannot modify their own employee record even when their role holds employee.update', async () => {
    // Pathological data: a Branch Admin account that also has an Employee row in their branch.
    await Employee.create({
      id: 50,
      user_id: BRANCH_ADMIN_A,
      branch_id: 1,
      employee_code: 'E50',
      position_id: await positionId('USHER'),
      status: 1,
    });
    await Account.create({ id: BRANCH_ADMIN_A, email: 'admin-a@cinema.test', password: 'hash', role: 2, status: 1 });
    const res = await request(app)
      .put('/api/employee/50')
      .set('Authorization', asAdminA())
      .send({ position_id: await positionId('CASHIER') });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SELF_MODIFICATION_FORBIDDEN');
  });
});

describe('a Branch Admin can never create or edit a SUPER_ADMIN', () => {
  it('has no permission on any user/role/block/approve/delete endpoint', async () => {
    const attempts = [
      request(app).put(`/api/users/${SUPER_ADMIN_ID}/role`).set('Authorization', asAdminA()).send({ role: 1 }),
      request(app).put('/api/users/5/role').set('Authorization', asAdminA()).send({ role: 0 }),
      request(app).put(`/api/block/${SUPER_ADMIN_ID}`).set('Authorization', asAdminA()),
      request(app).put(`/api/unblock/${SUPER_ADMIN_ID}`).set('Authorization', asAdminA()),
      request(app).put(`/api/users/${SUPER_ADMIN_ID}/approve`).set('Authorization', asAdminA()),
      request(app).delete(`/api/users/${SUPER_ADMIN_ID}`).set('Authorization', asAdminA()),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403);
    const root = await Account.findOne({ id: SUPER_ADMIN_ID });
    expect(root).toMatchObject({ role: 0, status: 1 });
  });

  it('an employee created through POST /api/employee is always role 3, whatever the body says', async () => {
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', asAdminA())
      .send({
        cinema_id: 1,
        email: 'sneaky@cinema.test',
        password: 'secret123',
        position_id: await positionId('USHER'),
        role: 0,
      });
    expect(res.status).toBe(201);
    expect((await Account.findOne({ email: 'sneaky@cinema.test' })).role).toBe(3);
  });

  it('cannot use the employee endpoints as a side door to a SUPER_ADMIN account', async () => {
    // An Employee row that points at the SUPER_ADMIN's account (bad data / a crafted record).
    await Employee.create({
      id: 80,
      user_id: SUPER_ADMIN_ID,
      branch_id: 1,
      employee_code: 'E80',
      position_id: await positionId('USHER'),
      status: 1,
    });
    const responses = await Promise.all([
      request(app).put('/api/employee/80').set('Authorization', asAdminA()).send({ status: 0 }),
      request(app).delete('/api/employee/80').set('Authorization', asAdminA()),
      request(app).post('/api/employee/80/reset-password').set('Authorization', asAdminA()),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NOT_AN_EMPLOYEE_ACCOUNT');
    }
    const root = await Account.findOne({ id: SUPER_ADMIN_ID }).select('+password');
    expect(root).toMatchObject({ role: 0, status: 1, password: 'root-hash' });
    expect((await Employee.findOne({ id: 80 })).status).toBe(1);
  });
});

describe('Position permissions are enforced by the backend, per branch', () => {
  const report = (branchId) => ({
    branch_id: branchId,
    category: 'SUSPICIOUS',
    severity: 'MEDIUM',
    title: 'Unattended bag',
  });

  it('SECURITY may file an incident at its own branch but not at another', async () => {
    await makeEmployee({ accountId: 70, branchId: 1, positionCode: 'SECURITY' });
    const own = await request(app).post('/api/incidents').set('Authorization', asEmployee(70)).send(report(1));
    expect(own.status).toBe(201);
    expect(own.body.reported_by).toBe(70);
    const other = await request(app).post('/api/incidents').set('Authorization', asEmployee(70)).send(report(2));
    expect(other.status).toBe(403);
  });

  it.each(['CASHIER', 'CHECK_IN_STAFF', 'USHER', 'CONCESSION_STAFF', 'FNB_STAFF', 'CLEANING_STAFF'])(
    '%s has no incident.create',
    async (code) => {
      await makeEmployee({ accountId: 70, branchId: 1, positionCode: code });
      const res = await request(app).post('/api/incidents').set('Authorization', asEmployee(70)).send(report(1));
      expect(res.status).toBe(403);
    },
  );

  it('a deactivated employee loses every Position grant', async () => {
    await makeEmployee({ accountId: 70, branchId: 1, positionCode: 'SECURITY', status: 0 });
    const res = await request(app).post('/api/incidents').set('Authorization', asEmployee(70)).send(report(1));
    expect(res.status).toBe(403);
    const permissions = await request(app).get('/api/user/permissions').set('Authorization', asEmployee(70));
    expect(permissions.body.positionCode).toBeNull();
    expect(permissions.body.permissions).not.toContain('incident.create');
  });

  it('an employee permission list is exactly the role grants plus their Position grants', async () => {
    await makeEmployee({ accountId: 70, positionCode: 'CHECK_IN_STAFF' });
    const res = await request(app).get('/api/user/permissions').set('Authorization', asEmployee(70));
    expect(res.body.roleCode).toBe('EMPLOYEE');
    expect(res.body.positionCode).toBe('CHECK_IN_STAFF');
    expect(res.body.permissions).toEqual(expect.arrayContaining(['ticket.read', 'ticket.checkin']));
    for (const forbidden of ['employee.update', 'position.read', 'booking.create', 'incident.create']) {
      expect(res.body.permissions).not.toContain(forbidden);
    }
  });
});

describe('inventory.view granted to concession positions is branch-scoped and read-only', () => {
  beforeEach(async () => {
    await Inventory.create([
      { id: 1, branch_id: 1, item: 'Popcorn A', quantity: 10, minimum_quantity: 2, unit: 'pcs' },
      { id: 2, branch_id: 2, item: 'Popcorn B', quantity: 10, minimum_quantity: 2, unit: 'pcs' },
    ]);
  });

  it.each(['CONCESSION_STAFF', 'FNB_STAFF'])('%s reads only the stock of the branch they are staffed at', async (code) => {
    await makeEmployee({ accountId: 70, branchId: 1, positionCode: code });
    const list = await request(app).get('/api/inventory').set('Authorization', asEmployee(70));
    expect(list.status).toBe(200);
    expect(list.body.data.map((i) => i.item)).toEqual(['Popcorn A']);

    expect((await request(app).get('/api/inventory/1').set('Authorization', asEmployee(70))).status).toBe(200);
    expect((await request(app).get('/api/inventory/2').set('Authorization', asEmployee(70))).status).toBe(403);
    expect((await request(app).get('/api/inventory').query({ branchId: 2 }).set('Authorization', asEmployee(70))).status).toBe(403);
  });

  it('never lets them write stock', async () => {
    await makeEmployee({ accountId: 70, branchId: 1, positionCode: 'CONCESSION_STAFF' });
    const create = await request(app)
      .post('/api/inventory')
      .set('Authorization', asEmployee(70))
      .send({ branch_id: 1, item: 'Hack', unit: 'pcs' });
    expect(create.status).toBe(403);
    expect((await request(app).post('/api/inventory/1/receive').set('Authorization', asEmployee(70)).send({ quantity: 5 })).status).toBe(403);
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(10);
  });

  it('a deactivated concession employee reads nothing', async () => {
    await makeEmployee({ accountId: 70, branchId: 1, positionCode: 'CONCESSION_STAFF', status: 0 });
    expect((await request(app).get('/api/inventory').set('Authorization', asEmployee(70))).status).toBe(403);
  });

  it('a Cashier has no inventory permission at all', async () => {
    await makeEmployee({ accountId: 70, branchId: 1, positionCode: 'CASHIER' });
    expect((await request(app).get('/api/inventory').set('Authorization', asEmployee(70))).status).toBe(403);
  });
});

describe('GET /api/position', () => {
  it('lists the active positions for a Branch Admin, and adds each Position grants on request', async () => {
    const plain = await request(app).get('/api/position').set('Authorization', asAdminA());
    expect(plain.status).toBe(200);
    expect(plain.body.map((p) => p.code)).toEqual(
      expect.arrayContaining(['USHER', 'FNB_STAFF', 'CONCESSION_STAFF', 'CHECK_IN_STAFF']),
    );
    expect(plain.body[0].permissions).toBeUndefined();

    const detailed = await request(app)
      .get('/api/position')
      .query({ withPermissions: 'true' })
      .set('Authorization', asAdminA());
    const security = detailed.body.find((p) => p.code === 'SECURITY');
    expect(security.permissions).toEqual([
      { code: 'incident.create', scope: 'BRANCH' },
      { code: 'incident.read', scope: 'BRANCH' },
      { code: 'room.read', scope: 'BRANCH' },
    ]);
    expect(detailed.body.find((p) => p.code === 'CLEANING_STAFF').permissions).toEqual([]);
  });

  it('is not readable by a customer', async () => {
    const res = await request(app).get('/api/position').set('Authorization', authHeader({ role: 1, accountId: 5 }));
    expect(res.status).toBe(403);
  });

  it('another branch admin sees the same read-only catalogue (positions are company-wide)', async () => {
    const res = await request(app).get('/api/position').set('Authorization', asAdminB());
    expect(res.status).toBe(200);
  });
});
