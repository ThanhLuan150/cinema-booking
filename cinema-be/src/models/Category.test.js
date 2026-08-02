const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Category = require('./Category');

beforeAll(async () => {
  await connect();
  await Category.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Category model', () => {
  it('creates a valid category and round-trips fields', async () => {
    const category = await Category.create({ id: 1, name: 'Action' });
    expect(category.id).toBe(1);
    expect(category.name).toBe('Action');
    expect(category.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Category({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Category.create({ id: 1, name: 'Action' });
    await expect(Category.create({ id: 1, name: 'Comedy' })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const category = await Category.create({ id: 1, name: 'Action' });
    const json = category.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.name).toBe('Action');
  });
});
