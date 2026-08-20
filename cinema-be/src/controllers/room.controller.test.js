const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const roomController = require('./room.controller');
const Room = require('../models/Room');
const Seat = require('../models/Seat');
const Schedule = require('../models/Schedule');

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
  it('list filters by branchId when provided', async () => {
    await Room.create([
      { id: 1, cinema_id: 1, name: 'R1' },
      { id: 2, cinema_id: 2, name: 'R2' },
    ]);
    const res = mockRes();
    await roomController.list({ query: { branchId: '1' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  describe('create', () => {
    it('rejects missing name, cinema_id, code or capacity', async () => {
      const res = mockRes();
      await roomController.create({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a non-positive capacity', async () => {
      const res = mockRes();
      await roomController.create({ body: { name: 'Room 1', cinema_id: '5', code: 'R1', capacity: 0 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_CAPACITY' }));
    });

    it('rejects an invalid type', async () => {
      const res = mockRes();
      await roomController.create(
        { body: { name: 'Room 1', cinema_id: '5', code: 'R1', capacity: 40, type: 'SCREEN_X' } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_ROOM_TYPE' }));
    });

    it('rejects a duplicate room code within the same branch', async () => {
      await Room.create({ id: 1, cinema_id: 5, name: 'Existing', code: 'R1', capacity: 40 });
      const res = mockRes();
      await roomController.create({ body: { name: 'Room 1', cinema_id: '5', code: 'R1', capacity: 40 } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_CODE_TAKEN' }));
    });

    it('allows the same room code in a different branch', async () => {
      await Room.create({ id: 99, cinema_id: 9, name: 'Existing', code: 'R1', capacity: 40 });
      const res = mockRes();
      await roomController.create({ body: { name: 'Room 1', cinema_id: '5', code: 'R1', capacity: 40 } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('creates a room with defaulted type', async () => {
      const res = mockRes();
      await roomController.create({ body: { name: 'Room 1', cinema_id: '5', code: 'R1', capacity: '40' } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const created = await Room.findOne({ name: 'Room 1' });
      expect(created.cinema_id).toBe(5);
      expect(created.code).toBe('R1');
      expect(created.type).toBe('2D');
      expect(created.capacity).toBe(40);
      expect(created.status).toBe('ACTIVE');
    });

    it('creates a room with an explicit type', async () => {
      const res = mockRes();
      await roomController.create({ body: { name: 'IMAX Room', cinema_id: '5', code: 'R2', capacity: 100, type: 'IMAX' } }, res);
      const created = await Room.findOne({ name: 'IMAX Room' });
      expect(created.type).toBe('IMAX');
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

    it('rejects an invalid status', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'A' });
      const res = mockRes();
      await roomController.update({ params: { id: 1 }, body: { status: 'INACTIVE' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_ROOM_STATUS' }));
    });

    it('sets the room to MAINTENANCE', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'A' });
      const res = mockRes();
      await roomController.update({ params: { id: 1 }, body: { status: 'MAINTENANCE' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'MAINTENANCE' }));
    });

    it('rejects a code already used by another room in the branch', async () => {
      await Room.create([
        { id: 1, cinema_id: 1, name: 'A', code: 'R1' },
        { id: 2, cinema_id: 1, name: 'B', code: 'R2' },
      ]);
      const res = mockRes();
      await roomController.update({ params: { id: 2 }, body: { code: 'R1' } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_CODE_TAKEN' }));
    });

    it('rejects a non-positive capacity', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'A' });
      const res = mockRes();
      await roomController.update({ params: { id: 1 }, body: { capacity: -5 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_CAPACITY' }));
    });
  });

  describe('remove', () => {
    it('returns 404 for an unknown room', async () => {
      const res = mockRes();
      await roomController.remove({ params: { id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('deletes the room and its seats', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'A' });
      await Seat.create([
        { id: 1, room_id: 1, seat_code: 'A1' },
        { id: 2, room_id: 1, seat_code: 'A2' },
      ]);
      const res = mockRes();
      await roomController.remove({ params: { id: 1 } }, res);
      expect(await Room.countDocuments()).toBe(0);
      expect(await Seat.countDocuments({ room_id: 1 })).toBe(0);
    });

    it('refuses to delete a room that still has showtimes scheduled', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'A' });
      await Schedule.create({
        id: 1,
        movie_id: 1,
        room_id: 1,
        cinema_id: 1,
        movie_date: '2026-01-10',
        time_begin: '10:00',
        time_end: '12:00',
        price: 1,
      });
      const res = mockRes();
      await roomController.remove({ params: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_HAS_SHOWTIMES' }));
      expect(await Room.countDocuments()).toBe(1);
    });

    it('allows deleting a room whose only showtimes are cancelled', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'A' });
      await Schedule.create({
        id: 1,
        movie_id: 1,
        room_id: 1,
        cinema_id: 1,
        movie_date: '2026-01-10',
        time_begin: '10:00',
        time_end: '12:00',
        price: 1,
        status: 'CANCELLED',
      });
      const res = mockRes();
      await roomController.remove({ params: { id: 1 } }, res);
      expect(await Room.countDocuments()).toBe(0);
    });
  });
});
