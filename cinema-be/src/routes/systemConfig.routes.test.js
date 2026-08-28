const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const systemConfigRoutes = require('./systemConfig.routes');
const systemConfigService = require('../services/systemConfig.service');
const Branch = require('../models/Branch');

const app = buildTestApp('/api/system-config', systemConfigRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => {
  await clearDatabase();
  systemConfigService.invalidateAll();
});
afterAll(async () => closeDatabase());

const SUPER_ADMIN = { role: 0, accountId: 1 };
const BRANCH_ADMIN = { role: 2, accountId: 42 };
const EMPLOYEE = { role: 3, accountId: 50 };
const CUSTOMER = { role: 1, accountId: 9 };

describe('systemConfig.routes — access control', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/system-config')).status).toBe(401);
  });

  it('forbids a customer and an employee (no systemConfig.* grant)', async () => {
    expect((await request(app).get('/api/system-config').set('Authorization', authHeader(CUSTOMER))).status).toBe(403);
    expect((await request(app).get('/api/system-config').set('Authorization', authHeader(EMPLOYEE))).status).toBe(403);
  });

  it('allows a super admin (Global Settings view)', async () => {
    const res = await request(app).get('/api/system-config').set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.branchId).toBeNull();
    expect(res.body.settings.length).toBeGreaterThan(0);
  });

  it('a branch admin is granted read/manage by default (seeded BRANCH scope)', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = await request(app)
      .get('/api/system-config?branchId=1')
      .set('Authorization', authHeader(BRANCH_ADMIN));
    expect(res.status).toBe(200);
  });
});

describe('systemConfig.routes — GET /meta', () => {
  it('returns the settings registry', async () => {
    const res = await request(app).get('/api/system-config/meta').set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.status).toBe(200);
    const keys = res.body.settings.map((s) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining(['BOOKING_HOLD_TIME', 'CANCELLATION_LIMIT', 'DEFAULT_CURRENCY', 'REFUND_POLICY']),
    );
  });
});

describe('systemConfig.routes — Global Settings (SUPER_ADMIN)', () => {
  it('reads a single setting, updates it, then resets it', async () => {
    const before = await request(app)
      .get('/api/system-config/BOOKING_HOLD_TIME')
      .set('Authorization', authHeader(SUPER_ADMIN));
    expect(before.body).toMatchObject({ value: 5, source: 'DEFAULT' });

    const updated = await request(app)
      .put('/api/system-config/BOOKING_HOLD_TIME')
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ value: 10 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ value: 10, source: 'GLOBAL' });

    const reset = await request(app)
      .delete('/api/system-config/BOOKING_HOLD_TIME')
      .set('Authorization', authHeader(SUPER_ADMIN));
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({ value: 5, source: 'DEFAULT' });
  });

  it('404s updating an unknown key', async () => {
    const res = await request(app)
      .put('/api/system-config/NOT_A_KEY')
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ value: 1 });
    expect(res.status).toBe(404);
  });

  it('400s with details for an invalid value', async () => {
    const res = await request(app)
      .put('/api/system-config/DEFAULT_CURRENCY')
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ value: 'EUR' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SETTING_INVALID');
  });

  it('a customer cannot update any setting', async () => {
    const res = await request(app)
      .put('/api/system-config/BOOKING_HOLD_TIME')
      .set('Authorization', authHeader(CUSTOMER))
      .send({ value: 10 });
    expect(res.status).toBe(403);
  });
});

describe('systemConfig.routes — Branch Settings (BRANCH_ADMIN)', () => {
  it('can override a branch-overridable setting for its own branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = await request(app)
      .put('/api/system-config/BOOKING_HOLD_TIME')
      .set('Authorization', authHeader(BRANCH_ADMIN))
      .send({ value: 8, branchId: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ value: 8, source: 'BRANCH', branchId: 1 });
  });

  it("cannot override another branch's setting", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'Other', code: 'OTH' });
    const res = await request(app)
      .put('/api/system-config/BOOKING_HOLD_TIME')
      .set('Authorization', authHeader(BRANCH_ADMIN))
      .send({ value: 8, branchId: 1 });
    expect(res.status).toBe(403);
  });

  it('cannot set the Global Setting (no branchId)', async () => {
    const res = await request(app)
      .put('/api/system-config/BOOKING_HOLD_TIME')
      .set('Authorization', authHeader(BRANCH_ADMIN))
      .send({ value: 8 });
    expect(res.status).toBe(403);
  });

  it('cannot override a non-branch-overridable setting even for its own branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = await request(app)
      .put('/api/system-config/TAX_RATE')
      .set('Authorization', authHeader(BRANCH_ADMIN))
      .send({ value: 5, branchId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SETTING_INVALID');
  });
});
