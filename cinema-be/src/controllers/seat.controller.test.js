const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const seatController = require('./seat.controller');
const Seat = require('../models/Seat');

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

    it('generates a seat grid with vip/couple rows applied', async () => {
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
    });

    it('replaces the existing seat map for that room', async () => {
      await Seat.create({ id: 1, room_id: 1, seat_code: 'Z1' });
      const res = mockRes();
      await seatController.generate({ params: { roomId: 1 }, body: { rows: ['A'], seatsPerRow: 1 } }, res);
      const seats = await Seat.find({ room_id: 1 });
      expect(seats).toHaveLength(1);
      expect(seats[0].seat_code).toBe('A1');
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown seat', async () => {
      const res = mockRes();
      await seatController.update({ params: { id: 999 }, body: { is_locked: true } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates whitelisted fields', async () => {
      await Seat.create({ id: 1, room_id: 1, seat_code: 'A1', is_locked: false });
      const res = mockRes();
      await seatController.update({ params: { id: 1 }, body: { is_locked: true, seat_type: 1 } }, res);
      const updated = await Seat.findOne({ id: 1 });
      expect(updated.is_locked).toBe(true);
      expect(updated.seat_type).toBe(1);
    });
  });
});
