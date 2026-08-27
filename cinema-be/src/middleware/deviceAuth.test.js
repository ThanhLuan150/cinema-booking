const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { requireDevice } = require('./deviceAuth');
const Device = require('../models/Device');
const { generateDeviceKey, hashDeviceKey } = require('../utils/deviceKey');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

async function seedDevice(key, overrides = {}) {
  return Device.create({
    id: 1,
    device_id: 'SCN-1',
    name: 'Scanner',
    branch_id: 1,
    api_key_hash: hashDeviceKey(key),
    status: 'ACTIVE',
    ...overrides,
  });
}

describe('requireDevice', () => {
  it('401s when the X-Device-Key header is absent', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireDevice({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s on an unrecognised key', async () => {
    await seedDevice(generateDeviceKey());
    const res = mockRes();
    const next = jest.fn();
    await requireDevice({ headers: { 'x-device-key': 'DEV-nope' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('403s when the device is not ACTIVE', async () => {
    const key = generateDeviceKey();
    await seedDevice(key, { status: 'MAINTENANCE' });
    const res = mockRes();
    const next = jest.fn();
    await requireDevice({ headers: { 'x-device-key': key } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DEVICE_NOT_ACTIVE' }));
  });

  it('attaches req.device, refreshes last_seen_at and calls next on a valid key', async () => {
    const key = generateDeviceKey();
    await seedDevice(key);
    const req = { headers: { 'x-device-key': key } };
    const res = mockRes();
    const next = jest.fn();
    await requireDevice(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.device.id).toBe(1);

    // last_seen_at is refreshed by a fire-and-forget write — poll briefly for it to land.
    let device;
    for (let i = 0; i < 50; i += 1) {
      device = await Device.findOne({ id: 1 });
      if (device.last_seen_at) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(device.last_seen_at).toBeInstanceOf(Date);
  });
});
