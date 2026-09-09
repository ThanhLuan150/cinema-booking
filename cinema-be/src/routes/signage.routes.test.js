const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const signageRoutes = require('./signage.routes');
const Branch = require('../models/Branch');
const Screen = require('../models/Screen');
const SignageContent = require('../models/SignageContent');
const SignageSchedule = require('../models/SignageSchedule');
const { hashScreenKey } = require('../utils/screenKey');

const app = buildTestApp('/api/signage', signageRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42;
const OWNER_B = 99;

async function seedBranches() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
}

describe('signage.routes wiring', () => {
  it('requires auth to list screens', async () => {
    const res = await request(app).get('/api/signage/screens?branchId=1');
    expect(res.status).toBe(401);
  });

  it('is forbidden for a plain employee (no signage.read)', async () => {
    await seedBranches();
    const res = await request(app)
      .get('/api/signage/screens?branchId=1')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }));
    expect(res.status).toBe(403);
  });

  it('lets the owning branch admin register a screen', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/signage/screens')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ branch_id: 1, name: 'Lobby wall', location: 'North' });
    expect(res.status).toBe(201);
    expect(res.body.branch_id).toBe(1);
  });

  it('forbids a branch admin from registering a screen in another branch', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/signage/screens')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
      .send({ branch_id: 1, name: 'x' });
    expect(res.status).toBe(403);
  });

  it('forbids a branch admin from reading another branch’s screen', async () => {
    await seedBranches();
    await Screen.create({ id: 1, branch_id: 1, name: 'A screen' });
    const res = await request(app)
      .get('/api/signage/screens/1')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }));
    expect(res.status).toBe(403);
  });

  it('serves a screen playback payload to the owning branch admin', async () => {
    await seedBranches();
    await Screen.create({ id: 1, branch_id: 1, name: 'A screen', status: 'ACTIVE' });
    const res = await request(app)
      .get('/api/signage/screens/1/playback')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('lets a super admin list content across every branch', async () => {
    await seedBranches();
    await SignageContent.create({ id: 1, branch_id: 1, type: 'ANNOUNCEMENT', title: 'Hi' });
    await SignageContent.create({ id: 2, branch_id: 2, type: 'ANNOUNCEMENT', title: 'Yo' });
    const res = await request(app)
      .get('/api/signage/contents')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('requires screenId for a branch-scoped schedules listing', async () => {
    await seedBranches();
    const res = await request(app)
      .get('/api/signage/schedules')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
    expect(res.status).toBe(400);
  });

  describe('GET /api/signage/playback (X-Screen-Key auth)', () => {
    it('401s without the screen key header', async () => {
      const res = await request(app).get('/api/signage/playback');
      expect(res.status).toBe(401);
    });

    it('401s with an unknown screen key', async () => {
      await Screen.create({ id: 1, branch_id: 1, name: 'S', status: 'ACTIVE', api_key_hash: hashScreenKey('SCR-real') });
      const res = await request(app).get('/api/signage/playback').set('X-Screen-Key', 'SCR-fake');
      expect(res.status).toBe(401);
    });

    it('403s for a screen that is not ACTIVE', async () => {
      await Screen.create({ id: 1, branch_id: 1, name: 'S', status: 'MAINTENANCE', api_key_hash: hashScreenKey('SCR-real') });
      const res = await request(app).get('/api/signage/playback').set('X-Screen-Key', 'SCR-real');
      expect(res.status).toBe(403);
    });

    it('returns the screen’s own live playlist for a valid key', async () => {
      await Screen.create({ id: 1, branch_id: 1, name: 'S', status: 'ACTIVE', api_key_hash: hashScreenKey('SCR-real') });
      await SignageContent.create({ id: 100, branch_id: 1, type: 'ANNOUNCEMENT', title: 'Welcome', status: 'ACTIVE' });
      await SignageSchedule.create({
        id: 1,
        content_id: 100,
        screen_id: 1,
        start_at: new Date(Date.now() - 3600_000),
        end_at: new Date(Date.now() + 3600_000),
        status: 'ACTIVE',
      });
      const res = await request(app).get('/api/signage/playback').set('X-Screen-Key', 'SCR-real');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Welcome');
    });
  });
});
