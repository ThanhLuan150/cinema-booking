const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const bookingRoutes = require('./booking.routes');
const Cinema = require('../models/Cinema');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

const app = buildTestApp('/api', bookingRoutes);

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

describe('booking.routes wiring', () => {
  it('POST /api/scheduleId requires auth', async () => {
    const res = await request(app).post('/api/scheduleId').send({});
    expect(res.status).toBe(401);
  });

  it('GET /api/bookseat/:scheduleId requires auth', async () => {
    const res = await request(app).get('/api/bookseat/1');
    expect(res.status).toBe(401);
  });

  it('POST /api/MomoPayment/ipn is public (verified via signature, not JWT)', async () => {
    const res = await request(app).post('/api/MomoPayment/ipn').send({ resultCode: '1', orderId: 'X' });
    expect(res.status).toBe(200);
  });

  it('GET /api/admin/invoices requires admin', async () => {
    const res = await request(app).get('/api/admin/invoices').set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/invoice/lookup/:code requires admin/branch-admin/employee role', async () => {
    const res = await request(app)
      .get('/api/invoice/lookup/ABC')
      .set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/invoice/counter-sale forbids an employee not staffed at the target cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .post('/api/invoice/counter-sale')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }))
      .send({ ticketIds: [1], accountId: 1, totalPrice: 1000, cinema_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/invoice/counter-sale allows an employee staffed at the target cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const ticketStaff = await Position.findOne({ code: 'TICKET_STAFF' });
    await Employee.create({
      id: 1,
      account_id: 7,
      cinema_id: 1,
      employee_code: 'EMP-000001',
      position_id: ticketStaff.id,
      status: 1,
    });
    const res = await request(app)
      .post('/api/invoice/counter-sale')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }))
      .send({ ticketIds: [1], accountId: 1, totalPrice: 1000, cinema_id: 1 });
    // Reaches the controller (past the cinema-access gate) and fails on the
    // ticket/cinema cross-check instead, since ticket 1 doesn't exist here.
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TICKET_CINEMA_MISMATCH');
  });

  it('POST /api/invoice/:id/checkin requires auth', async () => {
    const res = await request(app).post('/api/invoice/1/checkin').send({});
    expect(res.status).toBe(401);
  });
});
