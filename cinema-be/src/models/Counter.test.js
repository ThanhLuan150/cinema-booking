const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Counter = require('./Counter');

beforeAll(async () => {
  await connect();
  await Counter.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Counter model', () => {
  it('creates a valid counter and defaults seq to 0', async () => {
    const counter = await Counter.create({ name: 'movie' });
    expect(counter.seq).toBe(0);
  });

  it('fails validation when name is missing', () => {
    const err = new Counter({}).validateSync();
    expect(err.errors.name).toBeDefined();
  });

  it('enforces unique name', async () => {
    await Counter.create({ name: 'movie' });
    await expect(Counter.create({ name: 'movie' })).rejects.toThrow();
  });

  it('does not expose a toJSON _id transform (no withCleanJSON plugin)', async () => {
    const counter = await Counter.create({ name: 'movie' });
    const json = counter.toJSON();
    expect(json._id).toBeDefined();
  });
});
