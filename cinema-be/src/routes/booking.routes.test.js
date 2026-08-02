const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const bookingRoutes = require('./booking.routes');

const app = buildTestApp('/api', bookingRoutes);

beforeAll(async () => connect());
let logSpy;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
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

  it('GET /api/invoice/lookup/:code requires admin/theater-staff role', async () => {
    const res = await request(app)
      .get('/api/invoice/lookup/ABC')
      .set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });
});
