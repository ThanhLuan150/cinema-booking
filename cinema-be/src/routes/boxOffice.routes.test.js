const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const boxOfficeRoutes = require('./boxOffice.routes');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Booking = require('../models/Booking');

const app = buildTestApp('/api/box-office', boxOfficeRoutes);

beforeAll(async () => connect());
let logSpy;
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  await seedRbac();
  await seedPositions();
});
afterEach(async () => {
  await clearDatabase();
  logSpy.mockRestore();
});
afterAll(async () => closeDatabase());

describe('boxOffice.routes wiring', () => {
  it('POST /api/box-office/sell requires auth', async () => {
    const res = await request(app).post('/api/box-office/sell').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/box-office/sell forbids a CUSTOMER (no booking.create/ticket.create/payment.create)', async () => {
    const res = await request(app)
      .post('/api/box-office/sell')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }))
      .send({ scheduleId: 1, ticketIds: [1], accountId: 1, cinema_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/box-office/sell forbids an employee not staffed at the target cinema', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = await request(app)
      .post('/api/box-office/sell')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }))
      .send({ scheduleId: 1, ticketIds: [1], accountId: 1, cinema_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/box-office/sell reaches the controller for a CASHIER staffed at the target cinema', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const cashier = await Position.findOne({ code: 'CASHIER' });
    await Employee.create({
      id: 1,
      user_id: 7,
      branch_id: 1,
      employee_code: 'EMP-000001',
      position_id: cashier.id,
      status: 1,
    });
    const res = await request(app)
      .post('/api/box-office/sell')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }))
      .send({ scheduleId: 1, ticketIds: [1], accountId: 1, cinema_id: 1 });
    // Past every permission/branch gate; fails inside the controller because seat 1 was never
    // locked (this test only checks route wiring, not the sale itself).
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SEAT_NOT_LOCKED');
  });

  it('GET /api/box-office/bookings/:id/tickets requires auth', async () => {
    const res = await request(app).get('/api/box-office/bookings/1/tickets');
    expect(res.status).toBe(401);
  });

  it('GET /api/box-office/bookings/:id/tickets forbids a CUSTOMER (no ticket.create)', async () => {
    const res = await request(app)
      .get('/api/box-office/bookings/1/tickets')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/box-office/bookings/:id/tickets reaches the controller for a TICKET_STAFF holder', async () => {
    await Booking.create({ id: 1, code: 'POS-1', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 1 });
    const ticketStaff = await Position.findOne({ code: 'TICKET_STAFF' });
    await Employee.create({
      id: 1,
      user_id: 7,
      branch_id: 1,
      employee_code: 'EMP-000001',
      position_id: ticketStaff.id,
      status: 1,
    });
    const res = await request(app)
      .get('/api/box-office/bookings/1/tickets')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }));
    expect(res.status).toBe(200);
    expect(res.body.booking.id).toBe(1);
  });
});
