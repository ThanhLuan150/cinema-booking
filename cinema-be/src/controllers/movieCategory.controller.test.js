const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieCategoryController = require('./movieCategory.controller');
const MovieCategory = require('../models/MovieCategory');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieCategory.controller', () => {
  it('list returns all mappings', async () => {
    await MovieCategory.create({ id: 1, movie_id: 1, cat_id: 1 });
    const res = mockRes();
    await movieCategoryController.list({}, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ movie_id: 1, cat_id: 1 })]);
  });

  it('getCategoryIdsForMovie returns just the category ids', async () => {
    await MovieCategory.create([
      { id: 1, movie_id: 5, cat_id: 1 },
      { id: 2, movie_id: 5, cat_id: 2 },
    ]);
    const res = mockRes();
    await movieCategoryController.getCategoryIdsForMovie({ params: { movieId: 5 } }, res);
    expect(res.json).toHaveBeenCalledWith([1, 2]);
  });

  describe('create', () => {
    it('rejects missing movie_id or cat_id', async () => {
      const res = mockRes();
      await movieCategoryController.create({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a new mapping', async () => {
      const res = mockRes();
      await movieCategoryController.create({ body: { movie_id: 5, cat_id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(await MovieCategory.countDocuments()).toBe(1);
    });
  });

  it('removeForMovie deletes all mappings for that movie', async () => {
    await MovieCategory.create([
      { id: 1, movie_id: 5, cat_id: 1 },
      { id: 2, movie_id: 6, cat_id: 1 },
    ]);
    const res = mockRes();
    await movieCategoryController.removeForMovie({ params: { movieId: 5 } }, res);
    expect(await MovieCategory.countDocuments()).toBe(1);
  });
});
