const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const GiftCard = require('./GiftCard');

beforeAll(async () => {
  await connect();
  await GiftCard.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('GiftCard model', () => {
  it('creates a valid gift card and applies defaults', async () => {
    const card = await GiftCard.create({
      id: 1,
      code: 'gc100',
      initial_balance: 100000,
      remaining_balance: 100000,
    });
    expect(card.code).toBe('GC100'); // uppercased
    expect(card.cinema_id).toBeNull();
    expect(card.currency).toBe('VND');
    expect(card.owner_account_id).toBeNull();
    expect(card.issued_by).toBeNull();
    expect(card.redeemed_at).toBeNull();
    expect(card.expires_at).toBeNull();
    expect(card.status).toBe(GiftCard.STATUS.ACTIVE);
  });

  it('fails validation when required fields are missing', () => {
    const err = new GiftCard({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.initial_balance).toBeDefined();
    expect(err.errors.remaining_balance).toBeDefined();
  });

  it('rejects a status outside the enum', () => {
    const card = new GiftCard({
      id: 1,
      code: 'X',
      initial_balance: 1000,
      remaining_balance: 1000,
      status: 'INVALID',
    });
    const err = card.validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('rejects a negative balance', () => {
    const card = new GiftCard({
      id: 1,
      code: 'X',
      initial_balance: -1,
      remaining_balance: -1,
    });
    const err = card.validateSync();
    expect(err.errors.initial_balance).toBeDefined();
    expect(err.errors.remaining_balance).toBeDefined();
  });

  it('enforces unique id and code', async () => {
    await GiftCard.create({ id: 1, code: 'A', initial_balance: 1, remaining_balance: 1 });
    await expect(
      GiftCard.create({ id: 1, code: 'B', initial_balance: 1, remaining_balance: 1 }),
    ).rejects.toThrow();
    await expect(
      GiftCard.create({ id: 2, code: 'A', initial_balance: 1, remaining_balance: 1 }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const card = await GiftCard.create({ id: 1, code: 'A', initial_balance: 1, remaining_balance: 1 });
    const json = card.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
