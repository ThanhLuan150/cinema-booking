const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Cinema = require('./Cinema');

beforeAll(async () => {
  await connect();
  await Cinema.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Cinema model', () => {
  it('creates a valid cinema and applies defaults', async () => {
    const cinema = await Cinema.create({ id: 1, owner_id: 1, name: 'Cinema A' });
    expect(cinema.address).toBe('');
    expect(cinema.city).toBe('');
    expect(cinema.images).toEqual([]);
    expect(cinema.status).toBe(0);
    expect(cinema.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Cinema({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.owner_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'A' });
    await expect(Cinema.create({ id: 1, owner_id: 2, name: 'B' })).rejects.toThrow();
  });

  it('stores an array of image URLs', async () => {
    const cinema = await Cinema.create({ id: 1, owner_id: 1, name: 'A', images: ['a.jpg', 'b.jpg'] });
    expect(cinema.images).toEqual(['a.jpg', 'b.jpg']);
  });

  it('toJSON strips _id and __v', async () => {
    const cinema = await Cinema.create({ id: 1, owner_id: 1, name: 'A' });
    const json = cinema.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
