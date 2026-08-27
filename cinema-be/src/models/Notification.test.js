const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Notification = require('./Notification');

beforeAll(async () => {
  await connect();
  await Notification.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    account_id: 7,
    type: 'BOOKING_CREATED',
    title: 'Booking created',
    ...overrides,
  };
}

describe('Notification model', () => {
  it('defaults to PENDING / IN_APP / unread with no attempts', async () => {
    const n = await Notification.create(baseFields());
    expect(n.status).toBe('PENDING');
    expect(n.channels).toEqual(['IN_APP']);
    expect(n.attempts).toBe(0);
    expect(n.read_at).toBeNull();
    expect(n.sent_at).toBeNull();
  });

  it('requires id, account_id, type and title', () => {
    const err = new Notification({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.title).toBeDefined();
  });

  it('rejects an unknown event type and an unknown channel', () => {
    expect(new Notification(baseFields({ type: 'NOPE' })).validateSync().errors.type).toBeDefined();
    expect(new Notification(baseFields({ channels: ['SMS'] })).validateSync().errors['channels.0']).toBeDefined();
  });

  it('enforces a unique dedupe_key but allows many rows with none', async () => {
    await Notification.create(baseFields({ id: 1, dedupe_key: 'BOOKING_CREATED:7:1' }));
    await expect(
      Notification.create(baseFields({ id: 2, dedupe_key: 'BOOKING_CREATED:7:1' })),
    ).rejects.toThrow();
    // null dedupe_key is sparse — no collision
    await Notification.create(baseFields({ id: 3 }));
    await Notification.create(baseFields({ id: 4 }));
    expect(await Notification.countDocuments()).toBe(3);
  });

  it('never serialises internal delivery fields', async () => {
    const json = (
      await Notification.create(baseFields({ id: 9, dedupe_key: 'k', last_error: 'boom', attempts: 2, max_attempts: 5 }))
    ).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.dedupe_key).toBeUndefined();
    expect(json.last_error).toBeUndefined();
    expect(json.attempts).toBeUndefined();
    expect(json.max_attempts).toBeUndefined();
    expect(json.next_attempt_at).toBeUndefined();
    // but the customer-facing fields survive
    expect(json.type).toBe('BOOKING_CREATED');
    expect(json.status).toBe('PENDING');
  });
});
