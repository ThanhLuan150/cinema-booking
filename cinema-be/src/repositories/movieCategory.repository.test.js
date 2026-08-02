const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieCategoryRepository = require('./movieCategory.repository');
const MovieCategory = require('../models/MovieCategory');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieCategory.repository', () => {
  it('findAll returns all mappings sorted by id', async () => {
    await MovieCategory.create([
      { id: 2, movie_id: 1, cat_id: 2 },
      { id: 1, movie_id: 1, cat_id: 1 },
    ]);
    const result = await movieCategoryRepository.findAll();
    expect(result.map((m) => m.id)).toEqual([1, 2]);
  });

  it('findByMovieId filters by movie', async () => {
    await MovieCategory.create([
      { id: 1, movie_id: 1, cat_id: 1 },
      { id: 2, movie_id: 2, cat_id: 1 },
    ]);
    const result = await movieCategoryRepository.findByMovieId(1);
    expect(result).toHaveLength(1);
    expect(result[0].movie_id).toBe(1);
  });

  it('create persists a new mapping with numeric ids', async () => {
    const result = await movieCategoryRepository.create({ id: 1, movie_id: '10', cat_id: '20' });
    expect(result.movie_id).toBe(10);
    expect(result.cat_id).toBe(20);
  });

  it('deleteByMovieId removes all mappings for that movie', async () => {
    await MovieCategory.create([
      { id: 1, movie_id: 1, cat_id: 1 },
      { id: 2, movie_id: 1, cat_id: 2 },
      { id: 3, movie_id: 2, cat_id: 1 },
    ]);
    await movieCategoryRepository.deleteByMovieId(1);
    const remaining = await MovieCategory.find();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].movie_id).toBe(2);
  });
});
