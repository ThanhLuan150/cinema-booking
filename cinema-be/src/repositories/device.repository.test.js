const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const deviceRepository = require('./device.repository');
const Device = require('../models/Device');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, device_id: 'SCN-1', name: 'Scanner', branch_id: 1, api_key_hash: 'hash-1', ...overrides };
}

describe('device.repository', () => {
  it('filters and paginates by branch', async () => {
    await Device.create([baseFields({ id: 1, device_id: 'A', branch_id: 1 }), baseFields({ id: 2, device_id: 'B', branch_id: 2 })]);
    const { data, total } = await deviceRepository.findFiltered({ branch_id: 2 }, { skip: 0, limit: 20 });
    expect(total).toBe(1);
    expect(data[0].id).toBe(2);
  });

  it('looks a device up by device_id and by api key hash', async () => {
    await Device.create(baseFields({ api_key_hash: 'secret-hash' }));
    expect((await deviceRepository.findByDeviceId('SCN-1')).id).toBe(1);
    expect((await deviceRepository.findByApiKeyHash('secret-hash')).id).toBe(1);
    expect(await deviceRepository.findByApiKeyHash('other')).toBeNull();
  });

  it('resolves the branch id for a device and null for an unknown one', async () => {
    await Device.create(baseFields());
    expect(await deviceRepository.findBranchIdByDeviceId(1)).toBe(1);
    expect(await deviceRepository.findBranchIdByDeviceId(999)).toBeNull();
  });

  it('touchLastSeen stamps last_seen_at', async () => {
    await Device.create(baseFields());
    await deviceRepository.touchLastSeen(1);
    expect((await Device.findOne({ id: 1 })).last_seen_at).toBeInstanceOf(Date);
  });

  it('updates fields and removes', async () => {
    await deviceRepository.create(baseFields());
    const updated = await deviceRepository.updateFields(1, { status: 'INACTIVE', entrance_id: 4 });
    expect(updated.status).toBe('INACTIVE');
    expect(updated.entrance_id).toBe(4);
    await deviceRepository.remove(1);
    expect(await Device.findOne({ id: 1 })).toBeNull();
  });
});
