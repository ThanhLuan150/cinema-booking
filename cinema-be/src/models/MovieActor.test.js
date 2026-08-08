const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const MovieActor = require('./MovieActor');

beforeAll(async () => {
  await connect();
  await MovieActor.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('MovieActor model', () => {
  it('creates a valid mapping and applies defaults', async () => {
    const mapping = await MovieActor.create({ id: 1, movie_id: 1, actor_id: 1 });
    expect(mapping.character_name).toBe('');
    expect(mapping.is_lead).toBe(false);
  });

  it('fails validation when required fields are missing', () => {
    const err = new MovieActor({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.movie_id).toBeDefined();
    expect(err.errors.actor_id).toBeDefined();
  });

  it('enforces unique id', async () => {
    await MovieActor.create({ id: 1, movie_id: 1, actor_id: 1 });
    await expect(MovieActor.create({ id: 1, movie_id: 2, actor_id: 2 })).rejects.toThrow();
  });
});
