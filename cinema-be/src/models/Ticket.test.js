const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Ticket = require('./Ticket');

beforeAll(async () => {
  await connect();
  await Ticket.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Ticket model', () => {
  it('creates a valid ticket and applies defaults', async () => {
    const ticket = await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    expect(ticket.seat_type).toBe(0);
    expect(ticket.status).toBe(1);
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Ticket({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.schedule_id).toBeDefined();
    expect(err.errors.seat_index).toBeDefined();
    expect(err.errors.seat_code).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await expect(
      Ticket.create({ id: 1, schedule_id: 1, seat_index: 1, seat_code: 'A2' }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const ticket = await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    const json = ticket.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
