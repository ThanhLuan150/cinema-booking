const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const LoyaltyConfig = require('./LoyaltyConfig');

beforeAll(async () => {
  await connect();
  await LoyaltyConfig.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('LoyaltyConfig model', () => {
  it('creates with sensible defaults', async () => {
    const config = await LoyaltyConfig.create({});
    expect(config.id).toBe(1);
    expect(config.amount_per_point).toBe(10000);
    expect(config.points_expiry_days).toBe(365);
    expect(config.redeem_value_per_point).toBe(100);
    expect(config.min_redeem_points).toBe(100);
    expect(config.updated_by).toBeNull();
  });

  it('enforces a single document via unique id', async () => {
    await LoyaltyConfig.create({});
    await expect(LoyaltyConfig.create({})).rejects.toThrow();
  });

  it('exposes its singleton id constant', () => {
    expect(LoyaltyConfig.SINGLETON_ID).toBe(1);
  });

  it('allows points_expiry_days to be explicitly null (never expire)', async () => {
    const config = await LoyaltyConfig.create({ points_expiry_days: null });
    expect(config.points_expiry_days).toBeNull();
  });
});
