const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const Account = require('../models/Account');
const loyaltyRoutes = require('./loyalty.routes');

const app = buildTestApp('/api', loyaltyRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('loyalty.routes wiring', () => {
  it('GET /api/loyalty/me requires auth', async () => {
    const res = await request(app).get('/api/loyalty/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/loyalty/me returns the caller\'s own summary for a customer (OWN scope)', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 40 });
    const res = await request(app).get('/api/loyalty/me').set('Authorization', authHeader({ accountId: 1, role: 1 }));
    expect(res.status).toBe(200);
    expect(res.body.points_balance).toBe(40);
  });

  it('GET /api/loyalty/me/transactions reaches the controller for a customer', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const res = await request(app)
      .get('/api/loyalty/me/transactions')
      .set('Authorization', authHeader({ accountId: 1, role: 1 }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ total: 0 }));
  });

  it('POST /api/loyalty/redeem is reachable by a customer (OWN scope)', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 10 });
    const res = await request(app)
      .post('/api/loyalty/redeem')
      .set('Authorization', authHeader({ accountId: 1, role: 1 }))
      .send({ points: 10 });
    // Below the default min_redeem_points -> reaches the controller and is rejected on business rules,
    // not blocked by permissions (proves the route/permission wiring, not the business logic itself).
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BELOW_MIN_REDEEM');
  });

  it('GET /api/loyalty/config is admin-only', async () => {
    const forbidden = await request(app).get('/api/loyalty/config').set('Authorization', authHeader({ role: 1 }));
    expect(forbidden.status).toBe(403);

    const allowed = await request(app).get('/api/loyalty/config').set('Authorization', authHeader({ role: 0 }));
    expect(allowed.status).toBe(200);
  });

  it('PUT /api/loyalty/config is admin-only', async () => {
    const res = await request(app)
      .put('/api/loyalty/config')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ amount_per_point: 5000 });
    expect(res.status).toBe(403);
  });

  it('POST /api/loyalty/:accountId/adjust is admin-only', async () => {
    await Account.create({ id: 2, email: 'target@b.com', password: 'x' });
    const forbidden = await request(app)
      .post('/api/loyalty/2/adjust')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ amount: 10 });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .post('/api/loyalty/2/adjust')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ amount: 10 });
    expect(allowed.status).toBe(201);
  });

  it('GET /api/membership-levels is readable by a customer', async () => {
    const res = await request(app).get('/api/membership-levels').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/membership-levels is admin-only', async () => {
    const forbidden = await request(app)
      .post('/api/membership-levels')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'SILVER', name: 'Silver', min_points: 1000 });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .post('/api/membership-levels')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ code: 'SILVER', name: 'Silver', min_points: 1000 });
    expect(allowed.status).toBe(201);
  });

  it('PUT and DELETE /api/membership-levels/:id are admin-only', async () => {
    const created = await request(app)
      .post('/api/membership-levels')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ code: 'GOLD', name: 'Gold', min_points: 5000 });

    const forbiddenPut = await request(app)
      .put(`/api/membership-levels/${created.body.id}`)
      .set('Authorization', authHeader({ role: 1 }))
      .send({ name: 'Gold Tier' });
    expect(forbiddenPut.status).toBe(403);

    const forbiddenDelete = await request(app)
      .delete(`/api/membership-levels/${created.body.id}`)
      .set('Authorization', authHeader({ role: 1 }));
    expect(forbiddenDelete.status).toBe(403);

    const allowedDelete = await request(app)
      .delete(`/api/membership-levels/${created.body.id}`)
      .set('Authorization', authHeader({ role: 0 }));
    expect(allowedDelete.status).toBe(200);
  });
});
