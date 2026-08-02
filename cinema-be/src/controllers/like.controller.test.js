const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const likeController = require('./like.controller');
const Like = require('../models/Like');
const Movie = require('../models/Movie');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('like.controller', () => {
  it('mine returns liked movies for the caller', async () => {
    await Movie.create({ id: 1, name: 'Movie A', premiere_date: '2026-01-01' });
    await Like.create({ id: 1, movie_id: 1, account_id: 42 });
    const res = mockRes();
    await likeController.mine({ account: { accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ id: 1, name: 'Movie A' })]);
  });

  it('count returns the like count for a movie', async () => {
    await Like.create([
      { id: 1, movie_id: 1, account_id: 1 },
      { id: 2, movie_id: 1, account_id: 2 },
    ]);
    const res = mockRes();
    await likeController.count({ params: { movieId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(2);
  });

  describe('like', () => {
    it('rejects a missing movie_id', async () => {
      const res = mockRes();
      await likeController.like({ body: {}, account: { accountId: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a new like', async () => {
      const res = mockRes();
      await likeController.like({ body: { movie_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(await Like.countDocuments()).toBe(1);
    });

    it('returns the existing like instead of duplicating', async () => {
      await Like.create({ id: 1, movie_id: 5, account_id: 42 });
      const res = mockRes();
      await likeController.like({ body: { movie_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(await Like.countDocuments()).toBe(1);
    });
  });

  describe('unlike', () => {
    it('rejects a missing movie_id', async () => {
      const res = mockRes();
      await likeController.unlike({ body: {}, account: { accountId: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('removes the like', async () => {
      await Like.create({ id: 1, movie_id: 5, account_id: 42 });
      const res = mockRes();
      await likeController.unlike({ body: { movie_id: 5 }, account: { accountId: 42 } }, res);
      expect(await Like.countDocuments()).toBe(0);
    });
  });
});
