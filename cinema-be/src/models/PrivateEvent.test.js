const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const PrivateEvent = require('./PrivateEvent');

beforeAll(async () => {
  await connect();
  await PrivateEvent.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    customer_id: 7,
    branch_id: 1,
    room_id: 3,
    package_id: 2,
    start_at: new Date('2026-10-01T18:00:00Z'),
    end_at: new Date('2026-10-01T22:00:00Z'),
    guest_count: 40,
    ...overrides,
  };
}

describe('PrivateEvent model', () => {
  it('creates a valid event defaulting to REQUESTED', async () => {
    const event = await PrivateEvent.create(baseFields());
    expect(event.status).toBe('REQUESTED');
    expect(event.quoted_amount).toBeNull();
    expect(event.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new PrivateEvent({}).validateSync();
    for (const field of ['id', 'customer_id', 'branch_id', 'room_id', 'package_id', 'start_at', 'end_at', 'guest_count']) {
      expect(err.errors[field]).toBeDefined();
    }
  });

  it('rejects a guest_count below 1', () => {
    const err = new PrivateEvent(baseFields({ guest_count: 0 })).validateSync();
    expect(err.errors.guest_count).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new PrivateEvent(baseFields({ status: 'PENDING' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('exposes BLOCKING_STATUSES as every status except CANCELLED', () => {
    expect(PrivateEvent.BLOCKING_STATUSES).toEqual(
      expect.arrayContaining(['REQUESTED', 'QUOTED', 'APPROVED', 'PAID', 'CONFIRMED', 'COMPLETED']),
    );
    expect(PrivateEvent.BLOCKING_STATUSES).not.toContain('CANCELLED');
  });

  it('enforces a unique id', async () => {
    await PrivateEvent.create(baseFields());
    await expect(PrivateEvent.create(baseFields({ customer_id: 9 }))).rejects.toThrow();
  });
});
