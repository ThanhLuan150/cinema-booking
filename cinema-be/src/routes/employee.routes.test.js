const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const employeeRoutes = require('./employee.routes');
const Cinema = require('../models/Cinema');
const Employee = require('../models/Employee');

const app = buildTestApp('/api/employee', employeeRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
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
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/employee allows the owning branch admin', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1 });
    expect(res.status).toBe(201);
  });

  it('POST /api/employee allows super admin regardless of ownership', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1 });
    expect(res.status).toBe(201);
  });

  it('POST /api/employee is forbidden for a customer', async () => {
    const res = await request(app)
      .post('/api/employee')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_id: 1 });
    expect(res.status).toBe(403);
  });

  it('PUT /api/employee/:id forbids a branch admin from another cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    await Employee.create({ id: 1, account_id: 7, cinema_id: 1 });
    const res = await request(app)
      .put('/api/employee/1')
      .set('Authorization', authHeader({ role: 2, accountId: 99 }))
      .send({ position: 'Manager' });
    expect(res.status).toBe(403);
  });
});
