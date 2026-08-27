const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Entrance = require('./Entrance');

beforeAll(async () => {
  await connect();
  await Entrance.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, branch_id: 1, name: 'Main lobby', ...overrides };
}

describe('Entrance model', () => {
  it('creates a valid entrance and defaults status to ACTIVE', async () => {
    const entrance = await Entrance.create(baseFields());
    expect(entrance.status).toBe('ACTIVE');
    expect(entrance.code).toBe('');
    expect(entrance.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Entrance({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new Entrance(baseFields({ status: 'CLOSED' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Entrance.create(baseFields());
    await expect(Entrance.create(baseFields({ branch_id: 2 }))).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const json = (await Entrance.create(baseFields())).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
