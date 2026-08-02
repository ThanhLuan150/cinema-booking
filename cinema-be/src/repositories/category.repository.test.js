const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const categoryRepository = require('./category.repository');
const Category = require('../models/Category');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('category.repository', () => {
  it('findAll returns categories sorted by id ascending', async () => {
    await Category.create([
      { id: 2, name: 'Comedy' },
      { id: 1, name: 'Action' },
    ]);
    const result = await categoryRepository.findAll();
    expect(result.map((c) => c.id)).toEqual([1, 2]);
  });

  it('findById returns the matching category', async () => {
    await Category.create({ id: 1, name: 'Action' });
    const result = await categoryRepository.findById('1');
    expect(result.name).toBe('Action');
  });

  it('findById returns null when not found', async () => {
    const result = await categoryRepository.findById(999);
    expect(result).toBeNull();
  });

  it('create persists a new category', async () => {
    const result = await categoryRepository.create({ id: 3, name: 'Horror' });
    expect(result.id).toBe(3);
    const found = await Category.findOne({ id: 3 });
    expect(found.name).toBe('Horror');
  });
});
