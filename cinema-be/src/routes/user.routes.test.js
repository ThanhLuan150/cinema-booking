const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const userRoutes = require('./user.routes');
const Account = require('../models/Account');

const app = buildTestApp('/api', userRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('user.routes wiring', () => {
  it('GET /api/user requires auth', async () => {
    const res = await request(app).get('/api/user');
    expect(res.status).toBe(401);
  });

  it('GET /api/user reaches the controller for any authenticated account', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const res = await request(app).get('/api/user').set('Authorization', authHeader({ accountId: 1 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/users rejects a non-admin', async () => {
    const res = await request(app).get('/api/users').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/users allows admin', async () => {
    const res = await request(app).get('/api/users').set('Authorization', authHeader({ role: 0 }));
    expect(res.status).toBe(200);
  });

  it('PUT /api/block/:id requires admin', async () => {
    const res = await request(app)
      .put('/api/block/1')
      .set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });
});
