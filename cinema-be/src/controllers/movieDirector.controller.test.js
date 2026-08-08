const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieDirectorController = require('./movieDirector.controller');
const MovieDirector = require('../models/MovieDirector');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieDirector.controller', () => {
  it('list returns every mapping', async () => {
    await MovieDirector.create([{ id: 1, movie_id: 1, director_id: 1 }]);
    const res = mockRes();
    await movieDirectorController.list({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ movie_id: 1 })]));
  });

  it('getForMovie scopes to a single movie', async () => {
    await MovieDirector.create([
      { id: 1, movie_id: 1, director_id: 1 },
      { id: 2, movie_id: 2, director_id: 2 },
    ]);
    const res = mockRes();
    await movieDirectorController.getForMovie({ params: { movieId: 1 } }, res);
    expect(res.json.mock.calls[0][0]).toHaveLength(1);
  });

  describe('create', () => {
    it('rejects missing movie_id or director_id', async () => {
      const res = mockRes();
      await movieDirectorController.create({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a mapping', async () => {
      const res = mockRes();
      await movieDirectorController.create(
        { body: { movie_id: 1, director_id: 1 }, account: { role: 0, accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(await MovieDirector.findOne({ movie_id: 1 })).not.toBeNull();
    });
  });

  it('removeForMovie deletes all mappings for that movie', async () => {
    await MovieDirector.create([
      { id: 1, movie_id: 1, director_id: 1 },
      { id: 2, movie_id: 1, director_id: 2 },
    ]);
    const res = mockRes();
    await movieDirectorController.removeForMovie(
      { params: { movieId: 1 }, account: { role: 0, accountId: 1 } },
      res,
    );
    expect(await MovieDirector.countDocuments()).toBe(0);
  });
});
