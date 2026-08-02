const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const roomRepository = require('./room.repository');
const Room = require('../models/Room');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('room.repository', () => {
  it('findCinemaIdByRoomId returns the owning cinema id', async () => {
    await Room.create({ id: 1, cinema_id: 7, name: 'Room 1' });
    expect(await roomRepository.findCinemaIdByRoomId(1)).toBe(7);
  });

  it('findCinemaIdByRoomId returns null for an unknown room', async () => {
    expect(await roomRepository.findCinemaIdByRoomId(999)).toBeNull();
  });

  it('findAll paginates and filters', async () => {
    await Room.create([
      { id: 1, cinema_id: 1, name: 'Room 1' },
      { id: 2, cinema_id: 1, name: 'Room 2' },
      { id: 3, cinema_id: 2, name: 'Room 3' },
    ]);
    const result = await roomRepository.findAll({ cinema_id: 1 }, { skip: 0, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  it('create persists a new room', async () => {
    const room = await roomRepository.create({ id: 5, cinema_id: 1, name: 'New Room' });
    expect(room.name).toBe('New Room');
  });

  it('updateFields updates and returns the new document', async () => {
    await Room.create({ id: 1, cinema_id: 1, name: 'Old Name' });
    const updated = await roomRepository.updateFields(1, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
  });

  it('remove deletes the room', async () => {
    await Room.create({ id: 1, cinema_id: 1, name: 'Room 1' });
    await roomRepository.remove(1);
    expect(await Room.countDocuments()).toBe(0);
  });
});
