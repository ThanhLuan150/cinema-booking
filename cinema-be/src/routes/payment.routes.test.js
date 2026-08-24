const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const paymentRoutes = require('./payment.routes');
const paymentRepository = require('../repositories/payment.repository');

const app = buildTestApp('/api', paymentRoutes);

beforeAll(async () => connect());
let logSpy;
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  await seedRbac();
});
afterEach(async () => {
  await clearDatabase();
  logSpy.mockRestore();
});
afterAll(async () => closeDatabase());

describe('payment.routes wiring', () => {
  it('GET /api/payments/my requires auth', async () => {
    const res = await request(app).get('/api/payments/my');
    expect(res.status).toBe(401);
  });

  it('GET /api/payments/my is allowed for a customer (OWN scope)', async () => {
    const res = await request(app)
      .get('/api/payments/my')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /api/payments requires auth', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(401);
  });

  it('GET /api/payments scopes a customer\'s (OWN) results down to their own payments', async () => {
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000,
    });
    await paymentRepository.createPayment({
      code: 'BK-2', bookingId: 2, accountId: 2, type: 'ONLINE', method: 'MOMO', amount: 2000,
    });
    const res = await request(app)
      .get('/api/payments')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].code).toBe('BK-1');
  });

  it('GET /api/payments is allowed for super admin', async () => {
    const res = await request(app)
      .get('/api/payments')
      .set('Authorization', authHeader({ role: 0 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/payments/:id/refund/request is forbidden for a customer (booking.refund is admin-only)', async () => {
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000, status: 'PAID',
    });
    const res = await request(app)
      .post('/api/payments/1/refund/request')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }))
      .send({ reason: 'changed my mind' });
    expect(res.status).toBe(403);
  });

  it('POST /api/payments/:id/refund/request succeeds for super admin', async () => {
    const payment = await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000, status: 'PAID',
    });
    const res = await request(app)
      .post(`/api/payments/${payment.id}/refund/request`)
      .set('Authorization', authHeader({ role: 0 }))
      .send({ reason: 'changed my mind' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REFUND_PENDING');
  });

  it('POST /api/payments/:id/refund/confirm is forbidden for a branch admin (booking.refund is admin-only)', async () => {
    const payment = await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, branchId: 999, type: 'ONLINE', method: 'MOMO', amount: 1000, status: 'REFUND_PENDING',
    });
    const res = await request(app)
      .post(`/api/payments/${payment.id}/refund/confirm`)
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });
});
