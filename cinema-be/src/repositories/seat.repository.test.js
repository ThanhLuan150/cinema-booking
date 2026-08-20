const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const seatRepository = require('./seat.repository');
const Seat = require('../models/Seat');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('seat.repository', () => {
  it('findByRoomId returns seats sorted by id', async () => {
    await Seat.create([
      { id: 2, room_id: 1, seat_code: 'A2' },
      { id: 1, room_id: 1, seat_code: 'A1' },
    ]);
    const result = await seatRepository.findByRoomId(1);
    expect(result.map((s) => s.id)).toEqual([1, 2]);
  });

  it('deleteByRoomId removes only that room\'s seats', async () => {
    await Seat.create([
      { id: 1, room_id: 1, seat_code: 'A1' },
      { id: 2, room_id: 2, seat_code: 'A1' },
    ]);
    await seatRepository.deleteByRoomId(1);
    const remaining = await Seat.find();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].room_id).toBe(2);
  });

  it('insertMany bulk-creates seats', async () => {
    await seatRepository.insertMany([
      { id: 1, room_id: 1, seat_code: 'A1' },
      { id: 2, room_id: 1, seat_code: 'A2' },
    ]);
    expect(await Seat.countDocuments()).toBe(2);
  });

  it('findById returns the matching seat', async () => {
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    const seat = await seatRepository.findById('1');
    expect(seat.seat_code).toBe('A1');
  });

  it('updateFields updates and returns the seat', async () => {
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1', status: 'ACTIVE' });
    const updated = await seatRepository.updateFields(1, { status: 'DISABLED' });
    expect(updated.status).toBe('DISABLED');
  });
});
