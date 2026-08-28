const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const NotificationTemplate = require('./NotificationTemplate');

beforeAll(async () => {
  await connect();
  await NotificationTemplate.init(); // build the unique index
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seed(overrides = {}) {
  return NotificationTemplate.create({
    id: 1,
    event: NotificationTemplate.EVENT.BOOKING_SUCCESS,
    channel: NotificationTemplate.CHANNEL.EMAIL,
    subject: 'Hi {{customer_name}}',
    content: 'Booking {{booking_code}}',
    language: 'vi',
    ...overrides,
  });
}

describe('NotificationTemplate model', () => {
  it('persists a template with defaults for status and language', async () => {
    const t = await NotificationTemplate.create({
      id: 2,
      event: NotificationTemplate.EVENT.PAYMENT_SUCCESS,
      channel: NotificationTemplate.CHANNEL.IN_APP,
      content: 'Paid {{booking_code}}',
    });
    expect(t.status).toBe('ACTIVE');
    expect(t.language).toBe(NotificationTemplate.DEFAULT_LANGUAGE);
    expect(t.language).toBe('vi');
  });

  it('rejects an unknown event / channel / status / language via the schema enums', async () => {
    await expect(seed({ event: 'NOPE' })).rejects.toThrow();
    await expect(seed({ channel: 'PIGEON' })).rejects.toThrow();
    await expect(seed({ status: 'MAYBE' })).rejects.toThrow();
    await expect(seed({ language: 'xx' })).rejects.toThrow();
  });

  it('enforces one template per (event, channel, language)', async () => {
    await seed({ id: 1 });
    await expect(seed({ id: 2 })).rejects.toThrow(/duplicate key/i);
    // a different language for the same event+channel is allowed
    await expect(seed({ id: 3, language: 'en' })).resolves.toBeDefined();
  });

  it('strips _id / __v from JSON', async () => {
    const json = (await seed()).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.event).toBe('BOOKING_SUCCESS');
  });

  it('exposes SUPPORTED_CHANNELS as EMAIL + IN_APP only (SMS = architecture-only)', () => {
    expect(NotificationTemplate.SUPPORTED_CHANNELS).toEqual(['EMAIL', 'IN_APP']);
    expect(NotificationTemplate.CHANNEL.SMS).toBe('SMS');
  });

  it('lists allowed variables per event, and ticket_code only for TICKET_ISSUED', () => {
    expect(NotificationTemplate.allowedVariables('TICKET_ISSUED')).toContain('ticket_code');
    expect(NotificationTemplate.allowedVariables('BOOKING_SUCCESS')).not.toContain('ticket_code');
    expect(NotificationTemplate.allowedVariables('BOOKING_SUCCESS')).toEqual(
      expect.arrayContaining(['customer_name', 'movie_name', 'branch_name', 'showtime', 'seat', 'booking_code']),
    );
    expect(NotificationTemplate.allowedVariables('UNKNOWN_EVENT')).toEqual([]);
  });
});
