const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Schedule = require('./Schedule');

beforeAll(async () => {
  await connect();
  await Schedule.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Schedule model', () => {
  it('creates a valid schedule and round-trips fields', async () => {
    const schedule = await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 100000,
    });
    expect(schedule.movie_date).toBe('2026-01-01');
    expect(schedule.time_begin).toBe('10:00');
    expect(schedule.time_end).toBe('12:00');
    expect(schedule.price).toBe(100000);
    expect(schedule.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Schedule({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.movie_id).toBeDefined();
    expect(err.errors.room_id).toBeDefined();
    expect(err.errors.movie_date).toBeDefined();
    expect(err.errors.time_begin).toBeDefined();
    expect(err.errors.time_end).toBeDefined();
    expect(err.errors.price).toBeDefined();
  });

  it('defaults status to ACTIVE and accepts cinema_id', async () => {
    const schedule = await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      cinema_id: 5,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 100000,
    });
    expect(schedule.status).toBe('ACTIVE');
    expect(schedule.cinema_id).toBe(5);
  });

  it('enforces unique id', async () => {
    await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 1,
    });
    await expect(
      Schedule.create({
        id: 1,
        movie_id: 2,
        room_id: 2,
        movie_date: '2026-01-02',
        time_begin: '11:00',
        time_end: '13:00',
        price: 2,
      }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const schedule = await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 1,
    });
    const json = schedule.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
