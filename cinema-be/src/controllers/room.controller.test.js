const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const roomController = require('./room.controller');
const Room = require('../models/Room');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('room.controller', () => {
  it('list filters by cinemaId when provided', async () => {
    await Room.create([
      { id: 1, cinema_id: 1, name: 'R1' },
      { id: 2, cinema_id: 2, name: 'R2' },
    ]);
    const res = mockRes();
    await roomController.list({ query: { cinemaId: '1' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  describe('create', () => {
    it('rejects missing name or cinema_id', async () => {
      const res = mockRes();
      await roomController.create({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a room', async () => {
      const res = mockRes();
      await roomController.create({ body: { name: 'Room 1', cinema_id: '5' } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const created = await Room.findOne({ name: 'Room 1' });
      expect(created.cinema_id).toBe(5);
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown room', async () => {
      const res = mockRes();
      await roomController.update({ params: { id: 999 }, body: { name: 'X' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates the room name', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'Old' });
      const res = mockRes();
      await roomController.update({ params: { id: 1 }, body: { name: 'New' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' }));
    });
  });

  it('remove deletes the room', async () => {
    await Room.create({ id: 1, cinema_id: 1, name: 'A' });
    const res = mockRes();
    await roomController.remove({ params: { id: 1 } }, res);
    expect(await Room.countDocuments()).toBe(0);
  });
});
