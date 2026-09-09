const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Screen = require('./Screen');

beforeAll(async () => {
  await connect();
  await Screen.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, branch_id: 1, name: 'Lobby wall', ...overrides };
}

describe('Screen model', () => {
  it('creates a valid screen and defaults status to ACTIVE', async () => {
    const screen = await Screen.create(baseFields());
    expect(screen.status).toBe('ACTIVE');
    expect(screen.location).toBe('');
    expect(screen.device_id).toBe('');
    expect(screen.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Screen({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new Screen(baseFields({ status: 'OFF' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Screen.create(baseFields());
    await expect(Screen.create(baseFields({ branch_id: 2 }))).rejects.toThrow();
  });

  it('toJSON strips _id, __v and the api_key_hash', async () => {
    const json = (await Screen.create(baseFields({ api_key_hash: 'deadbeef' }))).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.api_key_hash).toBeUndefined();
  });
});
