jest.mock('../utils/uploadImage', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://cdn.example.com/actor-avatar.jpg'),
}));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const actorController = require('./actor.controller');
const uploadImage = require('../utils/uploadImage');
const Actor = require('../models/Actor');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

describe('actor.controller', () => {
  it('list returns paginated actors', async () => {
    await Actor.create([{ id: 1, full_name: 'A' }, { id: 2, full_name: 'B' }]);
    const res = mockRes();
    await actorController.list({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('getById returns 404 for an unknown actor', async () => {
    const res = mockRes();
    await actorController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  describe('create', () => {
    it('rejects missing full_name', async () => {
      const res = mockRes();
      await actorController.create({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates an actor', async () => {
      const res = mockRes();
      await actorController.create({ body: { full_name: 'New Actor' } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(await Actor.findOne({ full_name: 'New Actor' })).not.toBeNull();
    });

    it('uploads the avatar file when provided instead of using avatar_url', async () => {
      const res = mockRes();
      await actorController.create(
        { body: { full_name: 'With File' }, files: { avatar_url: [{ buffer: Buffer.from('x') }] } },
        res,
      );
      expect(uploadImage.uploadImage).toHaveBeenCalled();
      const created = await Actor.findOne({ full_name: 'With File' });
      expect(created.avatar_url).toBe('https://cdn.example.com/actor-avatar.jpg');
    });

    it('falls back to a plain avatar_url when no file is uploaded', async () => {
      const res = mockRes();
      await actorController.create({ body: { full_name: 'With URL', avatar_url: 'https://example.com/a.jpg' } }, res);
      const created = await Actor.findOne({ full_name: 'With URL' });
      expect(created.avatar_url).toBe('https://example.com/a.jpg');
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown actor', async () => {
      const res = mockRes();
      await actorController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates the actor', async () => {
      await Actor.create({ id: 1, full_name: 'Old' });
      const res = mockRes();
      await actorController.update({ params: { id: 1 }, body: { full_name: 'New' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'New' }));
    });
  });

  it('remove deletes the actor', async () => {
    await Actor.create({ id: 1, full_name: 'A' });
    const res = mockRes();
    await actorController.remove({ params: { id: 1 } }, res);
    expect(await Actor.countDocuments()).toBe(0);
  });
});
