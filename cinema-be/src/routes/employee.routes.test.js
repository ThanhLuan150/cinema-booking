const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const employeeRoutes = require('./employee.routes');
const Cinema = require('../models/Cinema');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Account = require('../models/Account');

const app = buildTestApp('/api/employee', employeeRoutes);

async function ticketStaffId() {
  const position = await Position.findOne({ code: 'TICKET_STAFF' });
  return position.id;
}

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('employee.routes wiring', () => {
  it('GET /api/employee requires auth', async () => {
    const res = await request(app).get('/api/employee').query({ cinemaId: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/employee forbids a branch admin who does not own the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1, position_id: await ticketStaffId() });
    expect(res.status).toBe(403);
  });

  it('POST /api/employee allows the owning branch admin', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1, position_id: await ticketStaffId() });
    expect(res.status).toBe(201);
    expect(res.body.employee_code).toMatch(/^EMP-\d{6}$/);
    expect(res.body.position.code).toBe('TICKET_STAFF');
  });

  it('POST /api/employee allows super admin regardless of ownership', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1, position_id: await ticketStaffId() });
    expect(res.status).toBe(201);
  });

  it('POST /api/employee is forbidden for a customer', async () => {
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1, position_id: await ticketStaffId() });
    expect(res.status).toBe(403);
  });

  it('POST /api/employee rejects an unknown position_id', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1, position_id: 999999 });
    expect(res.status).toBe(400);
  });

  it('POST /api/employee never escalates role even if the body sends one — always creates an EMPLOYEE (role 3)', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1, position_id: await ticketStaffId(), role: 0 });
    expect(res.status).toBe(201);
    const account = await Account.findOne({ email: 'a@b.com' });
    expect(account.role).toBe(3);
  });

  it('PUT /api/employee/:id forbids a branch admin from another cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    await Employee.create({ id: 1, account_id: 7, cinema_id: 1, employee_code: 'EMP-000001', position_id: await ticketStaffId() });
    const res = await request(app)
      .put('/api/employee/1')
      .set('Authorization', authHeader({ role: 2, accountId: 99 }))
      .send({ position_id: await ticketStaffId() });
    expect(res.status).toBe(403);
  });

  describe('POST /api/employee/:id/reset-password', () => {
    it('forbids a branch admin from another cinema', async () => {
      await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
      await Employee.create({ id: 1, account_id: 7, cinema_id: 1, employee_code: 'EMP-000001', position_id: await ticketStaffId() });
      const res = await request(app)
        .post('/api/employee/1/reset-password')
        .set('Authorization', authHeader({ role: 2, accountId: 99 }));
      expect(res.status).toBe(403);
    });

    it('allows the owning branch admin and does not return the new password', async () => {
      await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
      await Account.create({ id: 7, email: 'staff@b.com', password: 'oldhash', role: 3, status: 1 });
      await Employee.create({ id: 1, account_id: 7, cinema_id: 1, employee_code: 'EMP-000001', position_id: await ticketStaffId() });
      const res = await request(app)
        .post('/api/employee/1/reset-password')
        .set('Authorization', authHeader({ role: 2, accountId: 42 }));
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/oldhash/);
    });
  });
});
