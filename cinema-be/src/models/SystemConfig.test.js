const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const SystemConfig = require('./SystemConfig');

beforeAll(async () => {
  await connect();
  await SystemConfig.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('SystemConfig model', () => {
  it('creates a global override with branch_id null', async () => {
    const doc = await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 10 });
    expect(doc.branch_id).toBeNull();
    expect(doc.value).toBe(10);
  });

  it('creates a branch override', async () => {
    const doc = await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: 5, value: 7 });
    expect(doc.branch_id).toBe(5);
  });

  it('rejects a key outside the settings registry', async () => {
    await expect(SystemConfig.create({ id: 1, key: 'NOT_A_KEY', value: 1 })).rejects.toThrow();
  });

  it('enforces one override per (key, branch_id)', async () => {
    await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: 5, value: 5 });
    await expect(SystemConfig.create({ id: 2, key: 'BOOKING_HOLD_TIME', branch_id: 5, value: 6 })).rejects.toThrow();
  });

  it('allows the same key at the global level and a branch level simultaneously', async () => {
    await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
    await expect(
      SystemConfig.create({ id: 2, key: 'BOOKING_HOLD_TIME', branch_id: 5, value: 6 }),
    ).resolves.toBeTruthy();
  });

  it('allows different keys to each have their own global override', async () => {
    await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
    await expect(
      SystemConfig.create({ id: 2, key: 'CANCELLATION_LIMIT', branch_id: null, value: 3 }),
    ).resolves.toBeTruthy();
  });

  it('stores a JSON value (REFUND_POLICY tiers)', async () => {
    const tiers = [{ minHours: 24, percent: 100 }];
    const doc = await SystemConfig.create({ id: 1, key: 'REFUND_POLICY', branch_id: null, value: tiers });
    expect(doc.value).toEqual(tiers);
  });

  it('serializes without _id via toJSON', () => {
    const doc = new SystemConfig({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
    expect(doc.toJSON()._id).toBeUndefined();
  });
});
