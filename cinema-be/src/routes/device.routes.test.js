const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const deviceRoutes = require('./device.routes');
const Branch = require('../models/Branch');
const Device = require('../models/Device');
const { hashDeviceKey } = require('../utils/deviceKey');

const app = buildTestApp('/api/devices', deviceRoutes);

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

describe('device.routes wiring', () => {
  describe('management endpoints (user JWT)', () => {
    it('requires auth to list', async () => {
      const res = await request(app).get('/api/devices?branchId=1');
      expect(res.status).toBe(401);
    });

    it('is forbidden for a plain employee (no device.read)', async () => {
      await seedBranches();
      const res = await request(app).get('/api/devices?branchId=1').set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(res.status).toBe(403);
    });

    it('lets the owning branch admin register a device and returns the api_key once', async () => {
      await seedBranches();
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
        .send({ branch_id: 1, device_id: 'SCN-A-01', name: 'Lobby scanner' });
      expect(res.status).toBe(201);
      expect(res.body.api_key).toMatch(/^DEV-/);
      expect(res.body.api_key_hash).toBeUndefined();
    });

    it("forbids a branch admin from registering a device in another branch", async () => {
      await seedBranches();
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
        .send({ branch_id: 1, device_id: 'SCN-X', name: 'x' });
      expect(res.status).toBe(403);
    });

    it('exposes GET /api/devices/logs without treating "logs" as an id', async () => {
      await seedBranches();
      const res = await request(app)
        .get('/api/devices/logs?branchId=1')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('POST /api/devices/checkin (X-Device-Key auth)', () => {
    it('401s without the device key header', async () => {
      const res = await request(app).post('/api/devices/checkin').send({ qr_token: 'TCK-1' });
      expect(res.status).toBe(401);
    });

    it('401s with an unknown device key', async () => {
      await Device.create({ id: 1, device_id: 'SCN-1', name: 'S', branch_id: 1, api_key_hash: hashDeviceKey('DEV-real'), status: 'ACTIVE' });
      const res = await request(app).post('/api/devices/checkin').set('X-Device-Key', 'DEV-fake').send({ qr_token: 'TCK-1' });
      expect(res.status).toBe(401);
    });

    it('reaches the controller with a valid key (400 on a missing qr_token)', async () => {
      await Device.create({ id: 1, device_id: 'SCN-1', name: 'S', branch_id: 1, api_key_hash: hashDeviceKey('DEV-real'), status: 'ACTIVE' });
      const res = await request(app).post('/api/devices/checkin').set('X-Device-Key', 'DEV-real').send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('QR_TOKEN_REQUIRED');
    });
  });
});
