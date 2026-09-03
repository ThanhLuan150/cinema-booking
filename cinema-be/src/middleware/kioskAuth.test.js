const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { requireKiosk } = require('./kioskAuth');
const Kiosk = require('../models/Kiosk');
const { generateKioskKey, hashKioskKey } = require('../utils/kioskKey');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

async function seedKiosk(key, overrides = {}) {
  return Kiosk.create({
    id: 1,
    kiosk_code: 'KSK-1',
    name: 'Kiosk',
    branch_id: 1,
    guest_account_id: 900,
    api_key_hash: hashKioskKey(key),
    status: 'ACTIVE',
    ...overrides,
  });
}

describe('requireKiosk', () => {
  it('401s when the X-Kiosk-Key header is absent', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireKiosk({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s on an unknown key', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireKiosk({ headers: { 'x-kiosk-key': 'KIOSK-nope' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('403s a non-ACTIVE kiosk', async () => {
    const key = generateKioskKey();
    await seedKiosk(key, { status: 'MAINTENANCE' });
    const res = mockRes();
    const next = jest.fn();
    await requireKiosk({ headers: { 'x-kiosk-key': key } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.kiosk and refreshes last_seen_at for a valid key', async () => {
    const key = generateKioskKey();
    await seedKiosk(key);
    const req = { headers: { 'x-kiosk-key': key } };
    const res = mockRes();
    const next = jest.fn();
    await requireKiosk(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.kiosk.id).toBe(1);
    // fire-and-forget heartbeat
    await new Promise((r) => setTimeout(r, 10));
    const reloaded = await Kiosk.findOne({ id: 1 });
    expect(reloaded.last_seen_at).not.toBeNull();
  });
});
