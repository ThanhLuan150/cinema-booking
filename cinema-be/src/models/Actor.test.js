const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Actor = require('./Actor');

beforeAll(async () => {
  await connect();
  await Actor.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Actor model', () => {
  it('creates a valid actor and applies defaults', async () => {
    const actor = await Actor.create({ id: 1, full_name: 'Actor One' });
    expect(actor.avatar_url).toBe('');
    expect(actor.bio).toBe('');
    expect(actor.dob).toBeNull();
    expect(actor.nationality).toBe('');
  });

  it('fails validation when required fields are missing', () => {
    const err = new Actor({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.full_name).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Actor.create({ id: 1, full_name: 'A' });
    await expect(Actor.create({ id: 1, full_name: 'B' })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const actor = await Actor.create({ id: 1, full_name: 'A' });
    const json = actor.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
