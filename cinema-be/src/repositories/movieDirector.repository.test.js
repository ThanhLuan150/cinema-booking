const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieDirectorRepository = require('./movieDirector.repository');
const MovieDirector = require('../models/MovieDirector');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieDirector.repository', () => {
  it('findByMovieId returns only mappings for that movie', async () => {
    await MovieDirector.create([
      { id: 1, movie_id: 1, director_id: 1 },
      { id: 2, movie_id: 2, director_id: 2 },
    ]);
    const result = await movieDirectorRepository.findByMovieId(1);
    expect(result).toHaveLength(1);
    expect(result[0].director_id).toBe(1);
  });

  it('findByMovieIds returns mappings for several movies', async () => {
    await MovieDirector.create([
      { id: 1, movie_id: 1, director_id: 1 },
      { id: 2, movie_id: 2, director_id: 2 },
    ]);
    const result = await movieDirectorRepository.findByMovieIds([1, 2]);
    expect(result).toHaveLength(2);
  });

  it('create persists a new mapping', async () => {
    const mapping = await movieDirectorRepository.create({ id: 1, movie_id: 1, director_id: 1 });
    expect(mapping.director_id).toBe(1);
  });

  it('deleteByMovieId removes all mappings for that movie', async () => {
    await MovieDirector.create([
      { id: 1, movie_id: 1, director_id: 1 },
      { id: 2, movie_id: 2, director_id: 2 },
    ]);
    await movieDirectorRepository.deleteByMovieId(1);
    expect(await MovieDirector.countDocuments()).toBe(1);
  });
});
