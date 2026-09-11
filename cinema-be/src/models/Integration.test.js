const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Integration = require('./Integration');

beforeAll(async () => {
  await connect();
  await Integration.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, name: 'MoMo Wallet', provider: 'momo', type: 'PAYMENT_GATEWAY', ...overrides };
}

describe('Integration model', () => {
  it('creates a valid integration and applies defaults', async () => {
    const integration = await Integration.create(baseFields());
    expect(integration.status).toBe('ACTIVE');
    expect(integration.provider).toBe('MOMO'); // uppercased
    expect(integration.config).toEqual({});
    expect(integration.secret_env_var).toBeNull();
  });

  it('requires id, name, provider and type', () => {
    const err = new Integration({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.provider).toBeDefined();
    expect(err.errors.type).toBeDefined();
  });

  it('rejects an unknown type or status', () => {
    expect(new Integration(baseFields({ type: 'NOPE' })).validateSync().errors.type).toBeDefined();
    expect(new Integration(baseFields({ status: 'PAUSED' })).validateSync().errors.status).toBeDefined();
  });

  it('enforces a unique provider', async () => {
    await Integration.create(baseFields({ id: 1 }));
    await expect(Integration.create(baseFields({ id: 2, name: 'Other' }))).rejects.toThrow();
  });

  it('never stores or exposes anything beyond the secret env var name', async () => {
    const json = (await Integration.create(baseFields({ secret_env_var: 'MOMO_SECRET_KEY' }))).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.secret_env_var).toBe('MOMO_SECRET_KEY');
  });
});
