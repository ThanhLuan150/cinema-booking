const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const kioskRoutes = require('./kiosk.routes');
const Branch = require('../models/Branch');
const Kiosk = require('../models/Kiosk');
const Account = require('../models/Account');
const { generateKioskKey, hashKioskKey } = require('../utils/kioskKey');

const app = buildTestApp('/api/kiosks', kioskRoutes);

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

async function seedKiosk(key) {
  await Account.create({ id: 900, email: 'kiosk-1@kiosk.local', password: 'x', name: 'K1', role: 1 });
  return Kiosk.create({
    id: 1,
    kiosk_code: 'KSK-1',
    name: 'Lobby kiosk',
    branch_id: 1,
    guest_account_id: 900,
    api_key_hash: hashKioskKey(key),
    status: 'ACTIVE',
  });
}

describe('kiosk.routes wiring', () => {
  describe('admin endpoints (user JWT + kiosk.* permission)', () => {
    it('requires auth to list', async () => {
      const res = await request(app).get('/api/kiosks?branchId=1');
      expect(res.status).toBe(401);
    });

    it('is forbidden for a plain employee (no kiosk.read)', async () => {
      await seedBranches();
      const res = await request(app).get('/api/kiosks?branchId=1').set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(res.status).toBe(403);
    });

    it('lets the owning branch admin register a kiosk and returns the api_key once', async () => {
      await seedBranches();
      const res = await request(app)
        .post('/api/kiosks')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
        .send({ branch_id: 1, kiosk_code: 'KSK-A-01', name: 'Lobby kiosk' });
      expect(res.status).toBe(201);
      expect(res.body.api_key).toMatch(/^KIOSK-/);
      expect(res.body.api_key_hash).toBeUndefined();
      expect(res.body.guest_account_id).toBeGreaterThan(0);
    });

    it("forbids a branch admin registering a kiosk in another owner's branch", async () => {
      await seedBranches();
      const res = await request(app)
        .post('/api/kiosks')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
        .send({ branch_id: 2, kiosk_code: 'KSK-B-01', name: 'X' });
      expect(res.status).toBe(403);
    });
  });

  describe('self-service flow endpoints (X-Kiosk-Key)', () => {
    it('401s /session without a kiosk key', async () => {
      const res = await request(app).get('/api/kiosks/session');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('KIOSK_KEY_MISSING');
    });

    it('401s /session with an unknown key', async () => {
      const res = await request(app).get('/api/kiosks/session').set('X-Kiosk-Key', 'KIOSK-nope');
      expect(res.status).toBe(401);
    });

    it('returns the kiosk + branch for a valid key', async () => {
      await seedBranches();
      const key = generateKioskKey();
      await seedKiosk(key);
      const res = await request(app).get('/api/kiosks/session').set('X-Kiosk-Key', key);
      expect(res.status).toBe(200);
      expect(res.body.kiosk.kiosk_code).toBe('KSK-1');
      expect(res.body.branch.id).toBe(1);
    });

    it('403s a MAINTENANCE kiosk', async () => {
      const key = generateKioskKey();
      await seedKiosk(key);
      await Kiosk.updateOne({ id: 1 }, { $set: { status: 'MAINTENANCE' } });
      const res = await request(app).get('/api/kiosks/session').set('X-Kiosk-Key', key);
      expect(res.status).toBe(403);
    });

    it('does not accept a user JWT on a flow endpoint', async () => {
      const res = await request(app).get('/api/kiosks/movies').set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(401);
    });
  });
});
