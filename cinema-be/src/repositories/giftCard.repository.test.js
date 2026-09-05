const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const giftCardRepository = require('./giftCard.repository');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('giftCard.repository', () => {
  it('findOwnedCinemaIds returns branch ids owned by the account', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    expect(await giftCardRepository.findOwnedCinemaIds(42)).toEqual([1]);
  });

  it('findFiltered paginates on an arbitrary filter', async () => {
    await GiftCard.create([
      { id: 1, code: 'A', initial_balance: 1000, remaining_balance: 1000 },
      { id: 2, code: 'B', initial_balance: 2000, remaining_balance: 2000, cinema_id: 1 },
    ]);
    const result = await giftCardRepository.findFiltered({ cinema_id: 1 });
    expect(result.total).toBe(1);
    expect(result.data[0].code).toBe('B');
  });

  it('findMine only returns cards owned by that account', async () => {
    await GiftCard.create([
      { id: 1, code: 'A', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 42 },
      { id: 2, code: 'B', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 },
    ]);
    const result = await giftCardRepository.findMine(42);
    expect(result.total).toBe(1);
    expect(result.data[0].code).toBe('A');
  });

  it('findById finds a gift card by numeric id', async () => {
    await GiftCard.create({ id: 1, code: 'A', initial_balance: 1000, remaining_balance: 1000 });
    expect((await giftCardRepository.findById('1')).code).toBe('A');
  });

  it('findByCode is case-insensitive and returns any status', async () => {
    await GiftCard.create({ id: 1, code: 'BLOCK1', initial_balance: 1, remaining_balance: 1, status: 'BLOCKED' });
    expect(await giftCardRepository.findByCode('block1')).not.toBeNull();
  });

  it('create/updateFields manage a gift card document', async () => {
    const created = await giftCardRepository.create({ id: 1, code: 'A', initial_balance: 1000, remaining_balance: 1000 });
    expect(created.id).toBe(1);

    const updated = await giftCardRepository.updateFields(1, { status: 'BLOCKED' });
    expect(updated.status).toBe('BLOCKED');
  });

  it('findHistory paginates a gift card transaction trail', async () => {
    await GiftCardTransaction.create([
      { id: 1, gift_card_id: 1, type: 'ISSUE', balance_after: 1000 },
      { id: 2, gift_card_id: 1, type: 'REDEEM', balance_after: 1000 },
      { id: 3, gift_card_id: 2, type: 'ISSUE', balance_after: 500 },
    ]);
    const result = await giftCardRepository.findHistory(1);
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe(2); // sorted newest-first
  });
});
