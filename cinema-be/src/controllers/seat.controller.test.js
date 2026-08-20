const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const seatController = require('./seat.controller');
const Seat = require('../models/Seat');
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

describe('seat.controller', () => {
  it('listByRoom returns the seat map for a room', async () => {
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    const res = mockRes();
    await seatController.listByRoom({ params: { roomId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ seat_code: 'A1' })]);
  });

  describe('generate', () => {
    it('rejects missing rows or seatsPerRow', async () => {
      const res = mockRes();
      await seatController.generate({ params: { roomId: 1 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a non-positive seatsPerRow', async () => {
      const res = mockRes();
      await seatController.generate({ params: { roomId: 1 }, body: { rows: ['A'], seatsPerRow: 0 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_SEATS_PER_ROW' }));
    });

    it('rejects blank row labels', async () => {
      const res = mockRes();
      await seatController.generate({ params: { roomId: 1 }, body: { rows: ['A', ''], seatsPerRow: 2 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_ROWS' }));
    });

    it('generates a seat grid with vip/couple rows applied, and row/number populated', async () => {
      const res = mockRes();
      await seatController.generate(
        { params: { roomId: 1 }, body: { rows: ['A', 'B', 'C'], seatsPerRow: 2, vipRows: ['B'], coupleRows: ['C'] } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const seats = await Seat.find({ room_id: 1 }).sort({ seat_code: 1 });
      expect(seats).toHaveLength(6);
      expect(seats.find((s) => s.seat_code === 'A1').seat_type).toBe(0);
      expect(seats.find((s) => s.seat_code === 'B1').seat_type).toBe(1);
      expect(seats.find((s) => s.seat_code === 'C1').seat_type).toBe(2);
      const a1 = seats.find((s) => s.seat_code === 'A1');
      expect(a1.row).toBe('A');
      expect(a1.number).toBe(1);
      expect(a1.status).toBe('ACTIVE');
    });

    it('replaces the existing seat map for that room', async () => {
      await Seat.create({ id: 1, room_id: 1, seat_code: 'Z1' });
      const res = mockRes();
      await seatController.generate({ params: { roomId: 1 }, body: { rows: ['A'], seatsPerRow: 1 } }, res);
      const seats = await Seat.find({ room_id: 1 });
      expect(seats).toHaveLength(1);
      expect(seats[0].seat_code).toBe('A1');
    });

    it('syncs the room capacity to the generated seat count', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'R1', capacity: 999 });
      const res = mockRes();
      await seatController.generate({ params: { roomId: 1 }, body: { rows: ['A', 'B'], seatsPerRow: 4 } }, res);
      const room = await Room.findOne({ id: 1 });
      expect(room.capacity).toBe(8);
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown seat', async () => {
      const res = mockRes();
      await seatController.update({ params: { id: 999 }, body: { status: 'DISABLED' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects an invalid status', async () => {
      await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
      const res = mockRes();
      await seatController.update({ params: { id: 1 }, body: { status: 'LOCKED' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_SEAT_STATUS' }));
    });

    it('updates whitelisted fields', async () => {
      await Seat.create({ id: 1, room_id: 1, seat_code: 'A1', status: 'ACTIVE' });
      const res = mockRes();
      await seatController.update({ params: { id: 1 }, body: { status: 'DISABLED', seat_type: 1 } }, res);
      const updated = await Seat.findOne({ id: 1 });
      expect(updated.status).toBe('DISABLED');
      expect(updated.seat_type).toBe(1);
    });
  });
});
