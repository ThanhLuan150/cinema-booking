const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const notificationRoutes = require('./notification.routes');
const notificationRepository = require('../repositories/notification.repository');
const Notification = require('../models/Notification');

const app = buildTestApp('/api/notifications', notificationRoutes);

beforeAll(async () => {
  await connect();
  await Notification.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedFor(accountId, n = 2) {
  for (let i = 0; i < n; i += 1) {
    await notificationRepository.create({
      accountId, type: 'BOOKING_CREATED', title: `t${i}`, dedupeKey: `${accountId}:${i}`,
    });
  }
}

describe('notification.routes', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).get('/api/notifications/unread-count')).status).toBe(401);
    expect((await request(app).patch('/api/notifications/1/read')).status).toBe(401);
  });

  it('serves a plain customer their own feed (no RBAC permission required)', async () => {
    await seedFor(7, 3);
    await seedFor(99, 1);
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', authHeader({ role: 1, accountId: 7 }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data[0]).not.toHaveProperty('dedupe_key');
  });

  it('reports and clears the unread count', async () => {
    await seedFor(7, 2);
    const auth = authHeader({ role: 1, accountId: 7 });

    let res = await request(app).get('/api/notifications/unread-count').set('Authorization', auth);
    expect(res.body).toEqual({ count: 2 });

    res = await request(app).patch('/api/notifications/read-all').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 2 });

    res = await request(app).get('/api/notifications/unread-count').set('Authorization', auth);
    expect(res.body).toEqual({ count: 0 });
  });

  it('marks a single row read, and 404s a row owned by someone else', async () => {
    await seedFor(7, 1); // id 1
    await seedFor(99, 1); // id 2
    const auth = authHeader({ role: 1, accountId: 7 });

    expect((await request(app).patch('/api/notifications/1/read').set('Authorization', auth)).status).toBe(200);
    expect((await request(app).patch('/api/notifications/2/read').set('Authorization', auth)).status).toBe(404);
  });

  it('has no create/delete endpoints', async () => {
    const auth = authHeader({ role: 1, accountId: 7 });
    expect((await request(app).post('/api/notifications').set('Authorization', auth)).status).toBe(404);
    expect((await request(app).delete('/api/notifications/1').set('Authorization', auth)).status).toBe(404);
  });
});
