const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Seat = require('./Seat');

beforeAll(async () => {
  await connect();
  await Seat.init(); // ensure the compound unique index is built before tests rely on it
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Seat model', () => {
  it('creates a valid seat and applies defaults', async () => {
    const seat = await Seat.create({ id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1' });
    expect(seat.row).toBe('A');
    expect(seat.number).toBe(1);
    expect(seat.seat_type).toBe(0);
    expect(seat.status).toBe('ACTIVE');
    expect(seat.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Seat({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.room_id).toBeDefined();
    expect(err.errors.seat_code).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new Seat({ id: 1, room_id: 1, seat_code: 'A1', status: 'LOCKED' }).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('accepts DISABLED as a status', () => {
    expect(new Seat({ id: 1, room_id: 1, seat_code: 'A1', status: 'DISABLED' }).validateSync()).toBeUndefined();
  });

  it('enforces unique id', async () => {
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    await expect(Seat.create({ id: 1, room_id: 2, seat_code: 'A2' })).rejects.toThrow();
  });

  it('enforces a unique room_id/seat_code pair', async () => {
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    await expect(Seat.create({ id: 2, room_id: 1, seat_code: 'A1' })).rejects.toThrow();
  });

  it('allows the same seat_code in different rooms', async () => {
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    await expect(Seat.create({ id: 2, room_id: 2, seat_code: 'A1' })).resolves.toBeDefined();
  });

  it('toJSON strips _id and __v', async () => {
    const seat = await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    const json = seat.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
