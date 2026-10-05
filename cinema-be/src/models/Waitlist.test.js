const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Waitlist = require('./Waitlist');

beforeAll(async () => {
  await connect();
  await Waitlist.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const entry = (id, fields = {}) => ({ id, account_id: 10, schedule_id: 7, seat_count: 1, ...fields });

describe('Waitlist model', () => {
  it('defaults to WAITING with no offer', async () => {
    const row = await Waitlist.create(entry(1));
    expect(row).toMatchObject({ status: 'WAITING', offered_ticket_ids: [], booking_id: null, close_reason: null });
    expect(row.toJSON()).not.toHaveProperty('_id');
  });

  it.each(['WAITING', 'NOTIFIED'])('refuses a second active entry next to a %s one', async (status) => {
    await Waitlist.create(entry(1, { status }));
    await expect(Waitlist.create(entry(2))).rejects.toMatchObject({ code: 11000 });
  });

  it.each(['BOOKED', 'EXPIRED', 'CANCELLED'])('allows a new entry once the old one is %s', async (status) => {
    await Waitlist.create(entry(1, { status }));
    await expect(Waitlist.create(entry(2))).resolves.toMatchObject({ status: 'WAITING' });
  });

  it('keeps entries of other customers and other showtimes apart', async () => {
    await Waitlist.create(entry(1));
    await expect(Waitlist.create(entry(2, { account_id: 11 }))).resolves.toBeTruthy();
    await expect(Waitlist.create(entry(3, { schedule_id: 8 }))).resolves.toBeTruthy();
  });

  it('rejects an unknown status, close reason or an empty party', async () => {
    await expect(Waitlist.create(entry(1, { status: 'HELD' }))).rejects.toThrow();
    await expect(Waitlist.create(entry(2, { close_reason: 'BORED' }))).rejects.toThrow();
    await expect(Waitlist.create(entry(3, { seat_count: 0 }))).rejects.toThrow();
  });
});
