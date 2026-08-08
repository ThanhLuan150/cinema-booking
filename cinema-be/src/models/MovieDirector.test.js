const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const MovieDirector = require('./MovieDirector');

beforeAll(async () => {
  await connect();
  await MovieDirector.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('MovieDirector model', () => {
  it('creates a valid mapping', async () => {
    const mapping = await MovieDirector.create({ id: 1, movie_id: 1, director_id: 1 });
    expect(mapping.movie_id).toBe(1);
    expect(mapping.director_id).toBe(1);
  });

  it('fails validation when required fields are missing', () => {
    const err = new MovieDirector({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.movie_id).toBeDefined();
    expect(err.errors.director_id).toBeDefined();
  });

  it('enforces unique id', async () => {
    await MovieDirector.create({ id: 1, movie_id: 1, director_id: 1 });
    await expect(MovieDirector.create({ id: 1, movie_id: 2, director_id: 2 })).rejects.toThrow();
  });
});
