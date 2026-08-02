const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const MovieCategory = require('./MovieCategory');

beforeAll(async () => {
  await connect();
  await MovieCategory.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('MovieCategory model', () => {
  it('creates a valid movie category link and round-trips fields', async () => {
    const link = await MovieCategory.create({ id: 1, movie_id: 1, cat_id: 1 });
    expect(link.movie_id).toBe(1);
    expect(link.cat_id).toBe(1);
    expect(link.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new MovieCategory({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.movie_id).toBeDefined();
    expect(err.errors.cat_id).toBeDefined();
  });

  it('enforces unique id', async () => {
    await MovieCategory.create({ id: 1, movie_id: 1, cat_id: 1 });
    await expect(MovieCategory.create({ id: 1, movie_id: 2, cat_id: 2 })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const link = await MovieCategory.create({ id: 1, movie_id: 1, cat_id: 1 });
    const json = link.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
