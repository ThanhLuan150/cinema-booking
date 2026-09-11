const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Webhook = require('./Webhook');

beforeAll(async () => {
  await connect();
  await Webhook.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, provider: 'momo', event: 'payment.success', ...overrides };
}

describe('Webhook model', () => {
  it('creates a valid webhook and applies defaults', async () => {
    const webhook = await Webhook.create(baseFields());
    expect(webhook.status).toBe('PENDING');
    expect(webhook.attempts).toBe(0);
    expect(webhook.max_attempts).toBe(5);
    expect(webhook.signature_verified).toBe(false);
    expect(webhook.processed_at).toBeNull();
    expect(webhook.provider).toBe('MOMO'); // uppercased
  });

  it('requires id, provider and event', () => {
    const err = new Webhook({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.provider).toBeDefined();
    expect(err.errors.event).toBeDefined();
  });

  it('rejects an unknown status', () => {
    expect(new Webhook(baseFields({ status: 'NOPE' })).validateSync().errors.status).toBeDefined();
  });

  it('enforces a unique (provider, external_id) pair but allows many rows with none', async () => {
    await Webhook.create(baseFields({ id: 1, external_id: 'ORDER-1:tx-1' }));
    await expect(
      Webhook.create(baseFields({ id: 2, external_id: 'ORDER-1:tx-1' })),
    ).rejects.toThrow();
    // Same external_id under a different provider is not a collision.
    await Webhook.create(baseFields({ id: 3, provider: 'STRIPE', external_id: 'ORDER-1:tx-1' }));
    // Absent external_id is sparse — no collision between rows that don't have one.
    await Webhook.create(baseFields({ id: 4 }));
    await Webhook.create(baseFields({ id: 5 }));
    expect(await Webhook.countDocuments()).toBe(4);
  });

  it('never serialises internal Mongo fields', async () => {
    const json = (await Webhook.create(baseFields({ id: 9, last_error: 'boom' }))).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.last_error).toBe('boom');
  });
});
