const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const directorController = require('./director.controller');
const Director = require('../models/Director');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('director.controller', () => {
  it('list returns paginated directors', async () => {
    await Director.create([{ id: 1, full_name: 'A' }, { id: 2, full_name: 'B' }]);
    const res = mockRes();
    await directorController.list({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('getById returns 404 for an unknown director', async () => {
    const res = mockRes();
    await directorController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  describe('create', () => {
    it('rejects missing full_name', async () => {
      const res = mockRes();
      await directorController.create({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a director', async () => {
      const res = mockRes();
      await directorController.create({ body: { full_name: 'New Director' } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(await Director.findOne({ full_name: 'New Director' })).not.toBeNull();
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown director', async () => {
      const res = mockRes();
      await directorController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates the director', async () => {
      await Director.create({ id: 1, full_name: 'Old' });
      const res = mockRes();
      await directorController.update({ params: { id: 1 }, body: { full_name: 'New' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'New' }));
    });
  });

  it('remove deletes the director', async () => {
    await Director.create({ id: 1, full_name: 'A' });
    const res = mockRes();
    await directorController.remove({ params: { id: 1 } }, res);
    expect(await Director.countDocuments()).toBe(0);
  });
});
