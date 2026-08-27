const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Device = require('./Device');

beforeAll(async () => {
  await connect();
  await Device.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    device_id: 'SCN-A-01',
    name: 'Lobby scanner',
    branch_id: 1,
    api_key_hash: 'deadbeef',
    ...overrides,
  };
}

describe('Device model', () => {
  it('creates a valid device with ACTIVE status and no entrance/last_seen by default', async () => {
    const device = await Device.create(baseFields());
    expect(device.status).toBe('ACTIVE');
    expect(device.entrance_id).toBeNull();
    expect(device.last_seen_at).toBeNull();
  });

  it('fails validation when required fields are missing', () => {
    const err = new Device({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.device_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.api_key_hash).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new Device(baseFields({ status: 'BROKEN' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces a unique device_id', async () => {
    await Device.create(baseFields());
    await expect(Device.create(baseFields({ id: 2 }))).rejects.toThrow();
  });

  it('never serialises the api_key_hash', async () => {
    const json = (await Device.create(baseFields())).toJSON();
    expect(json.api_key_hash).toBeUndefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
