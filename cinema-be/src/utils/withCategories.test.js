const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { withCategories } = require('./withCategories');
const Category = require('../models/Category');
const MovieCategory = require('../models/MovieCategory');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('withCategories', () => {
  it('attaches matching categories to each movie', async () => {
    await Category.create([
      { id: 1, name: 'Action' },
      { id: 2, name: 'Comedy' },
    ]);
    await MovieCategory.create([
      { id: 1, movie_id: 100, cat_id: 1 },
      { id: 2, movie_id: 100, cat_id: 2 },
      { id: 3, movie_id: 200, cat_id: 2 },
    ]);

    const movies = [{ id: 100, title: 'Movie A' }, { id: 200, title: 'Movie B' }];
    const result = await withCategories(movies);

    const movieA = result.find((m) => m.id === 100);
    const movieB = result.find((m) => m.id === 200);
    expect(movieA.categories.map((c) => c.name).sort()).toEqual(['Action', 'Comedy']);
    expect(movieB.categories.map((c) => c.name)).toEqual(['Comedy']);
  });

  it('gives an empty categories array to a movie with no mappings', async () => {
    const result = await withCategories([{ id: 999, title: 'Uncategorized' }]);
    expect(result[0].categories).toEqual([]);
  });

  it('ignores mappings that point at a non-existent category', async () => {
    await MovieCategory.create({ id: 1, movie_id: 300, cat_id: 999 });
    const result = await withCategories([{ id: 300, title: 'Movie C' }]);
    expect(result[0].categories).toEqual([]);
  });

  it('calls toJSON on mongoose documents instead of spreading raw internals', async () => {
    const movieDoc = {
      id: 400,
      toJSON: () => ({ id: 400, title: 'Via toJSON' }),
    };
    const result = await withCategories([movieDoc]);
    expect(result[0]).toEqual({ id: 400, title: 'Via toJSON', categories: [] });
  });
});
