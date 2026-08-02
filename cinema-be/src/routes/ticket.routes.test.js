const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const ticketRoutes = require('./ticket.routes');

const app = buildTestApp('/api/ticket', ticketRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('ticket.routes wiring', () => {
  it('POST /api/ticket requires auth', async () => {
    const res = await request(app).post('/api/ticket').send({ schedule_id: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/ticket requires admin role', async () => {
    const res = await request(app)
      .post('/api/ticket')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ schedule_id: 1 });
    expect(res.status).toBe(403);
  });

  it('PUT /api/ticket/:id only requires auth (any role)', async () => {
    const res = await request(app)
      .put('/api/ticket/999')
      .set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(404); // reached controller, ticket not found
  });
});
