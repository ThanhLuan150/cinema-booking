const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const FavoriteCinema = require('./FavoriteCinema');

beforeAll(async () => {
  await connect();
  await FavoriteCinema.init(); // ensure the compound unique index is built before tests rely on it
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('FavoriteCinema model', () => {
  it('creates a valid favorite and round-trips fields', async () => {
    const fav = await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 1 });
    expect(fav.cinema_id).toBe(1);
    expect(fav.account_id).toBe(1);
    expect(fav.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new FavoriteCinema({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.cinema_id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
  });

  it('enforces unique id', async () => {
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 1 });
    await expect(FavoriteCinema.create({ id: 1, cinema_id: 2, account_id: 2 })).rejects.toThrow();
  });

  it('enforces a unique cinema_id/account_id pair', async () => {
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 1 });
    await expect(FavoriteCinema.create({ id: 2, cinema_id: 1, account_id: 1 })).rejects.toThrow();
  });

  it('allows the same cinema favorited by different accounts', async () => {
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 1 });
    await expect(FavoriteCinema.create({ id: 2, cinema_id: 1, account_id: 2 })).resolves.toBeDefined();
  });

  it('toJSON strips _id and __v', async () => {
    const fav = await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 1 });
    const json = fav.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
