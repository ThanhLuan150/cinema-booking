const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Combo = require('./Combo');

beforeAll(async () => {
  await connect();
  await Combo.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Combo model', () => {
  it('creates a valid combo and applies defaults', async () => {
    const combo = await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn', price: 50000 });
    expect(combo.description).toBe('');
    expect(combo.image).toBe('');
    expect(combo.active).toBe(true);
    expect(combo.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Combo({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.cinema_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.price).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'A', price: 1 });
    await expect(Combo.create({ id: 1, cinema_id: 1, name: 'B', price: 2 })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const combo = await Combo.create({ id: 1, cinema_id: 1, name: 'A', price: 1 });
    const json = combo.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
