const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Like = require('./Like');

beforeAll(async () => {
  await connect();
  await Like.init(); // ensure the compound unique index is built before tests rely on it
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Like model', () => {
  it('creates a valid like and round-trips fields', async () => {
    const like = await Like.create({ id: 1, movie_id: 1, account_id: 1 });
    expect(like.movie_id).toBe(1);
    expect(like.account_id).toBe(1);
    expect(like.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Like({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.movie_id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Like.create({ id: 1, movie_id: 1, account_id: 1 });
    await expect(Like.create({ id: 1, movie_id: 2, account_id: 2 })).rejects.toThrow();
  });

  it('enforces a unique movie_id/account_id pair', async () => {
    await Like.create({ id: 1, movie_id: 1, account_id: 1 });
    await expect(Like.create({ id: 2, movie_id: 1, account_id: 1 })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const like = await Like.create({ id: 1, movie_id: 1, account_id: 1 });
    const json = like.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
