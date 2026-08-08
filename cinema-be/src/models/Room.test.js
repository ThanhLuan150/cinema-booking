const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Room = require('./Room');

beforeAll(async () => {
  await connect();
  await Room.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Room model', () => {
  it('creates a valid room and round-trips fields', async () => {
    const room = await Room.create({ id: 1, cinema_id: 1, name: 'Room 1' });
    expect(room.cinema_id).toBe(1);
    expect(room.name).toBe('Room 1');
    expect(room.status).toBe('ACTIVE');
    expect(room.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Room({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.cinema_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Room.create({ id: 1, cinema_id: 1, name: 'A' });
    await expect(Room.create({ id: 1, cinema_id: 2, name: 'B' })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const room = await Room.create({ id: 1, cinema_id: 1, name: 'A' });
    const json = room.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
