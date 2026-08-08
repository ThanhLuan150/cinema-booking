const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Director = require('./Director');

beforeAll(async () => {
  await connect();
  await Director.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Director model', () => {
  it('creates a valid director and applies defaults', async () => {
    const director = await Director.create({ id: 1, full_name: 'Director One' });
    expect(director.avatar_url).toBe('');
    expect(director.bio).toBe('');
    expect(director.dob).toBeNull();
    expect(director.nationality).toBe('');
  });

  it('fails validation when required fields are missing', () => {
    const err = new Director({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.full_name).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Director.create({ id: 1, full_name: 'A' });
    await expect(Director.create({ id: 1, full_name: 'B' })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const director = await Director.create({ id: 1, full_name: 'A' });
    const json = director.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
