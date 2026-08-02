const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const categoryController = require('./category.controller');
const Category = require('../models/Category');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('category.controller', () => {
  it('list returns all categories', async () => {
    await Category.create([{ id: 1, name: 'Action' }, { id: 2, name: 'Comedy' }]);
    const res = mockRes();
    await categoryController.list({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'Action' }),
      expect.objectContaining({ name: 'Comedy' }),
    ]));
  });

  it('getById returns 404 for an unknown category', async () => {
    const res = mockRes();
    await categoryController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getById returns the matching category', async () => {
    await Category.create({ id: 1, name: 'Action' });
    const res = mockRes();
    await categoryController.getById({ params: { id: '1' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Action' }));
  });

  it('create rejects a missing name', async () => {
    const res = mockRes();
    await categoryController.create({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('create persists a new category with an assigned id', async () => {
    const res = mockRes();
    await categoryController.create({ body: { name: 'Horror' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Category.findOne({ name: 'Horror' });
    expect(created).not.toBeNull();
  });
});
