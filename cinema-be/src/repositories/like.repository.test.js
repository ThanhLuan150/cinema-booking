const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const likeRepository = require('./like.repository');
const Like = require('../models/Like');
const Movie = require('../models/Movie');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('like.repository', () => {
  it('findMine returns the account\'s likes and the liked movies', async () => {
    await Movie.create({ id: 1, name: 'Movie A', premiere_date: '2026-01-01' });
    await Like.create({ id: 1, movie_id: 1, account_id: 42 });
    const result = await likeRepository.findMine(42);
    expect(result.likes).toHaveLength(1);
    expect(result.movies).toHaveLength(1);
    expect(result.movies[0].name).toBe('Movie A');
  });

  it('countByMovieId counts likes for a movie', async () => {
    await Like.create([
      { id: 1, movie_id: 1, account_id: 1 },
      { id: 2, movie_id: 1, account_id: 2 },
      { id: 3, movie_id: 2, account_id: 1 },
    ]);
    expect(await likeRepository.countByMovieId(1)).toBe(2);
  });

  it('findOne finds a like by movie and account', async () => {
    await Like.create({ id: 1, movie_id: 1, account_id: 42 });
    const found = await likeRepository.findOne({ movieId: 1, accountId: 42 });
    expect(found).not.toBeNull();
    const notFound = await likeRepository.findOne({ movieId: 1, accountId: 99 });
    expect(notFound).toBeNull();
  });

  it('create then remove a like', async () => {
    await likeRepository.create({ id: 1, movieId: '5', accountId: 42 });
    expect(await Like.countDocuments()).toBe(1);
    await likeRepository.remove({ movieId: '5', accountId: 42 });
    expect(await Like.countDocuments()).toBe(0);
  });
});
