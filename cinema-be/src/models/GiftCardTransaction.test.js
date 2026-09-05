const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const GiftCardTransaction = require('./GiftCardTransaction');

beforeAll(async () => {
  await connect();
  await GiftCardTransaction.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('GiftCardTransaction model', () => {
  it('creates a valid transaction and applies defaults', async () => {
    const tx = await GiftCardTransaction.create({
      id: 1,
      gift_card_id: 1,
      type: GiftCardTransaction.TYPE.ISSUE,
      balance_after: 100000,
    });
    expect(tx.account_id).toBeNull();
    expect(tx.amount).toBe(0);
    expect(tx.booking_id).toBeNull();
    expect(tx.reason).toBeNull();
  });

  it('fails validation when required fields are missing', () => {
    const err = new GiftCardTransaction({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.gift_card_id).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.balance_after).toBeDefined();
  });

  it('rejects a type outside the enum', () => {
    const tx = new GiftCardTransaction({ id: 1, gift_card_id: 1, type: 'INVALID', balance_after: 0 });
    const err = tx.validateSync();
    expect(err.errors.type).toBeDefined();
  });

  it('blocks a second USE row for the same gift card + booking (duplicate-spend guard)', async () => {
    await GiftCardTransaction.create({
      id: 1,
      gift_card_id: 1,
      type: GiftCardTransaction.TYPE.USE,
      booking_id: 5,
      balance_after: 0,
    });
    await expect(
      GiftCardTransaction.create({
        id: 2,
        gift_card_id: 1,
        type: GiftCardTransaction.TYPE.USE,
        booking_id: 5,
        balance_after: 0,
      }),
    ).rejects.toThrow();
  });

  it('allows multiple USE rows for the same gift card against different bookings', async () => {
    await GiftCardTransaction.create({ id: 1, gift_card_id: 1, type: GiftCardTransaction.TYPE.USE, booking_id: 5, balance_after: 5000 });
    await expect(
      GiftCardTransaction.create({ id: 2, gift_card_id: 1, type: GiftCardTransaction.TYPE.USE, booking_id: 6, balance_after: 0 }),
    ).resolves.toBeTruthy();
  });

  it('allows multiple ISSUE/REDEEM rows with no booking_id (partial index only guards USE)', async () => {
    await GiftCardTransaction.create({ id: 1, gift_card_id: 1, type: GiftCardTransaction.TYPE.ISSUE, balance_after: 100000 });
    await expect(
      GiftCardTransaction.create({ id: 2, gift_card_id: 1, type: GiftCardTransaction.TYPE.REDEEM, balance_after: 100000 }),
    ).resolves.toBeTruthy();
  });
});
