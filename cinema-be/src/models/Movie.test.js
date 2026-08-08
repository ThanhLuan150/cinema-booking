const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Movie = require('./Movie');

beforeAll(async () => {
  await connect();
  await Movie.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Movie model', () => {
  it('creates a valid movie and applies defaults', async () => {
    const movie = await Movie.create({ id: 1, name: 'Inception', premiere_date: '2010-07-16' });
    expect(movie.owner_id).toBeNull();
    expect(movie.avatar).toBe('');
    expect(movie.description).toBe('');
    expect(movie.country).toBe('');
    expect(movie.trailer).toBe('');
    expect(movie.producer).toBe('');
    expect(movie.status).toBe('ACTIVE');
    expect(movie.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a status outside ACTIVE/INACTIVE', () => {
    const err = new Movie({ id: 1, name: 'A', premiere_date: '2020-01-01', status: 'DRAFT' }).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('fails validation when required fields are missing', () => {
    const err = new Movie({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.premiere_date).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Movie.create({ id: 1, name: 'A', premiere_date: '2020-01-01' });
    await expect(Movie.create({ id: 1, name: 'B', premiere_date: '2020-01-02' })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const movie = await Movie.create({ id: 1, name: 'A', premiere_date: '2020-01-01' });
    const json = movie.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
