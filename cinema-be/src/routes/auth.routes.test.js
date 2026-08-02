const request = require('supertest');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const authRoutes = require('./auth.routes');

const app = buildTestApp('/api', authRoutes);

describe('auth.routes wiring', () => {
  it('POST /api/Login is public and reaches the controller', async () => {
    const res = await request(app).post('/api/Login').send({});
    expect(res.status).toBe(400); // reached controller validation, not blocked by auth
  });

  it('POST /api/change-password requires auth', async () => {
    const res = await request(app).post('/api/change-password').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/change-password reaches the controller with a valid token', async () => {
    const res = await request(app)
      .post('/api/change-password')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400); // validation error from the controller, not 401
  });
});
