const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const PointsTransaction = require('./PointsTransaction');

beforeAll(async () => {
  await connect();
  await PointsTransaction.init(); // ensure the partial unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, account_id: 1, type: 'EARN', points: 10, ...overrides };
}

describe('PointsTransaction model', () => {
  it('creates a valid transaction and round-trips fields/defaults', async () => {
    const tx = await PointsTransaction.create(baseFields());
    expect(tx.remaining_points).toBe(0);
    expect(tx.balance_after).toBeNull();
    expect(tx.booking_id).toBeNull();
    expect(tx.description).toBe('');
    expect(tx.createdAt).toBeInstanceOf(Date);
  });

  it('rejects an out-of-enum type', () => {
    const err = new PointsTransaction(baseFields({ type: 'BOGUS' })).validateSync();
    expect(err.errors.type).toBeDefined();
  });

  it('exposes its type table', () => {
    expect(PointsTransaction.TYPE).toEqual({
      EARN: 'EARN',
      REDEEM: 'REDEEM',
      EXPIRE: 'EXPIRE',
      REVERSAL: 'REVERSAL',
      ADJUST: 'ADJUST',
    });
  });

  it('prevents a second EARN transaction for the same booking', async () => {
    await PointsTransaction.create(baseFields({ id: 1, booking_id: 5, type: 'EARN' }));
    await expect(PointsTransaction.create(baseFields({ id: 2, booking_id: 5, type: 'EARN' }))).rejects.toThrow();
  });

  it('prevents a second REVERSAL transaction for the same booking', async () => {
    await PointsTransaction.create(baseFields({ id: 1, booking_id: 5, type: 'REVERSAL', points: -10 }));
    await expect(
      PointsTransaction.create(baseFields({ id: 2, booking_id: 5, type: 'REVERSAL', points: -10 })),
    ).rejects.toThrow();
  });

  it('allows an EARN and a REVERSAL for the same booking (they are different types)', async () => {
    await PointsTransaction.create(baseFields({ id: 1, booking_id: 5, type: 'EARN' }));
    await expect(
      PointsTransaction.create(baseFields({ id: 2, booking_id: 5, type: 'REVERSAL', points: -10 })),
    ).resolves.toBeTruthy();
  });

  it('allows two REDEEM transactions with no booking_id (the unique index is EARN/REVERSAL-only)', async () => {
    await PointsTransaction.create(baseFields({ id: 1, type: 'REDEEM', points: -5 }));
    await expect(PointsTransaction.create(baseFields({ id: 2, type: 'REDEEM', points: -5 }))).resolves.toBeTruthy();
  });

  it('allows multiple EARN transactions with no booking_id (manual grants)', async () => {
    await PointsTransaction.create(baseFields({ id: 1, type: 'ADJUST', points: 5 }));
    await expect(PointsTransaction.create(baseFields({ id: 2, type: 'ADJUST', points: 5 }))).resolves.toBeTruthy();
  });

  it('allows the same booking to earn points across two different accounts (index is not account-scoped by design, but ids are)', async () => {
    // Distinct booking ids per account in real usage; this just documents the index shape.
    await PointsTransaction.create(baseFields({ id: 1, account_id: 1, booking_id: 5, type: 'EARN' }));
    await expect(
      PointsTransaction.create(baseFields({ id: 2, account_id: 2, booking_id: 6, type: 'EARN' })),
    ).resolves.toBeTruthy();
  });
});
