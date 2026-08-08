const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieActorController = require('./movieActor.controller');
const MovieActor = require('../models/MovieActor');
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

describe('movieActor.controller', () => {
  it('list returns every mapping', async () => {
    await MovieActor.create([{ id: 1, movie_id: 1, actor_id: 1 }]);
    const res = mockRes();
    await movieActorController.list({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ movie_id: 1 })]));
  });

  it('getForMovie scopes to a single movie', async () => {
    await MovieActor.create([
      { id: 1, movie_id: 1, actor_id: 1 },
      { id: 2, movie_id: 2, actor_id: 2 },
    ]);
    const res = mockRes();
    await movieActorController.getForMovie({ params: { movieId: 1 } }, res);
    expect(res.json.mock.calls[0][0]).toHaveLength(1);
  });

  describe('create', () => {
    it('rejects missing movie_id or actor_id', async () => {
      const res = mockRes();
      await movieActorController.create({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a mapping', async () => {
      const res = mockRes();
      await movieActorController.create(
        { body: { movie_id: 1, actor_id: 1, character_name: 'Hero', is_lead: true }, account: { role: 0, accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const mapping = await MovieActor.findOne({ movie_id: 1 });
      expect(mapping.character_name).toBe('Hero');
    });

    it('rejects a theater owner tagging a movie they did not create', async () => {
      await Movie.create({ id: 1, owner_id: 99, name: 'A', premiere_date: '2026-01-01' });
      const res = mockRes();
      await movieActorController.create(
        { body: { movie_id: 1, actor_id: 1 }, account: { role: 2, accountId: 42 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(await MovieActor.countDocuments()).toBe(0);
    });
  });

  it('removeForMovie deletes all mappings for that movie', async () => {
    await MovieActor.create([
      { id: 1, movie_id: 1, actor_id: 1 },
      { id: 2, movie_id: 1, actor_id: 2 },
    ]);
    const res = mockRes();
    await movieActorController.removeForMovie(
      { params: { movieId: 1 }, account: { role: 0, accountId: 1 } },
      res,
    );
    expect(await MovieActor.countDocuments()).toBe(0);
  });
});
