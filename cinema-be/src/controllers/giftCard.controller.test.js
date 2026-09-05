const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const giftCardController = require('./giftCard.controller');
const GiftCard = require('../models/GiftCard');
const Branch = require('../models/Branch');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('GET /api/gift-cards (list)', () => {
  it('scopes an owner (role 2) to gift cards on their own cinemas', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await GiftCard.create([
      { id: 1, cinema_id: 1, code: 'MINE', initial_balance: 1000, remaining_balance: 1000 },
      { id: 2, cinema_id: 2, code: 'NOTMINE', initial_balance: 1000, remaining_balance: 1000 },
    ]);
    const res = mockRes();
    await giftCardController.list({ query: {}, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('returns all gift cards for admin', async () => {
    await GiftCard.create([
      { id: 1, cinema_id: 1, code: 'A', initial_balance: 1000, remaining_balance: 1000 },
      { id: 2, code: 'B', initial_balance: 1000, remaining_balance: 1000 },
    ]);
    const res = mockRes();
    await giftCardController.list({ query: {}, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('scopes a customer (OWN) to only their own cards, never leaking another\'s', async () => {
    await GiftCard.create([
      { id: 1, code: 'MINE', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 42 },
      { id: 2, code: 'NOTMINE', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 },
    ]);
    const res = mockRes();
    await giftCardController.list({ query: {}, account: { role: 1, accountId: 42 }, permissionScope: 'OWN' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});

describe('GET /api/gift-cards/mine', () => {
  it("returns only the caller's own gift cards", async () => {
    await GiftCard.create([
      { id: 1, code: 'MINE', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 42 },
      { id: 2, code: 'NOT', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 },
    ]);
    const res = mockRes();
    await giftCardController.mine({ query: {}, account: { accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});

describe('POST /api/gift-cards (issue)', () => {
  it('rejects missing code or initial_balance', async () => {
    const res = mockRes();
    await giftCardController.issue({ body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a non-positive initial_balance', async () => {
    const res = mockRes();
    await giftCardController.issue({ body: { code: 'X', initial_balance: 0 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('only admin can issue system-wide (cinema_id null) gift cards', async () => {
    const res = mockRes();
    await giftCardController.issue(
      { body: { code: 'SYS', initial_balance: 1000 }, account: { role: 2, accountId: 1 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids an owner issuing for a cinema they do not own', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = mockRes();
    await giftCardController.issue(
      { body: { cinema_id: 1, code: 'X', initial_balance: 1000 }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admin issues a system-wide gift card', async () => {
    const res = mockRes();
    await giftCardController.issue(
      { body: { code: 'SYS100', initial_balance: 100000 }, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await GiftCard.findOne({});
    expect(created.code).toBe('SYS100');
    expect(created.remaining_balance).toBe(100000);
  });

  it('rejects a duplicate code', async () => {
    await GiftCard.create({ id: 1, code: 'DUP', initial_balance: 1, remaining_balance: 1 });
    const res = mockRes();
    await giftCardController.issue(
      { body: { code: 'dup', initial_balance: 1000 }, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GIFT_CARD_CODE_EXISTS' }));
  });
});

describe('POST /api/gift-cards/redeem', () => {
  it('rejects a request with no code', async () => {
    const res = mockRes();
    await giftCardController.redeem({ body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('claims the card into the caller account', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000 });
    const res = mockRes();
    await giftCardController.redeem({ body: { code: 'gc1' }, account: { accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ owner_account_id: 42 }));
  });

  it('rejects redeeming a card already owned by someone else', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 });
    const res = mockRes();
    await giftCardController.redeem({ body: { code: 'GC1' }, account: { accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GIFT_CARD_ALREADY_REDEEMED' }));
  });
});

describe('POST /api/gift-cards/pay', () => {
  async function seedOrder() {
    await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      cinema_id: 5,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 100000,
    });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 42 });
  }

  it('rejects a seat not held by the caller', async () => {
    await seedOrder();
    await Ticket.updateOne({ id: 1 }, { $set: { held_by: 999 } });
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 200000, remaining_balance: 200000, owner_account_id: 42 });
    const res = mockRes();
    await giftCardController.pay({ body: { code: 'GC1', ticketIds: [1] }, account: { accountId: 42 }, headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('pays the full order and returns a bookingId', async () => {
    await seedOrder();
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 200000, remaining_balance: 200000, owner_account_id: 42 });
    const res = mockRes();
    await giftCardController.pay({ body: { code: 'GC1', ticketIds: [1] }, account: { accountId: 42 }, headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ totalPrice: 100000 }));
    expect((await GiftCard.findOne({ id: 1 })).remaining_balance).toBe(100000);
  });

  it('returns 409 with the shortfall when the balance cannot cover the order', async () => {
    await seedOrder();
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 42 });
    const res = mockRes();
    await giftCardController.pay({ body: { code: 'GC1', ticketIds: [1] }, account: { accountId: 42 }, headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSUFFICIENT_BALANCE', shortfall: 99000 }));
  });
});

describe('PUT /api/gift-cards/:id and POST /:id/block', () => {
  it('blocks a gift card', async () => {
    await GiftCard.create({ id: 1, code: 'A', initial_balance: 1000, remaining_balance: 1000 });
    const res = mockRes();
    await giftCardController.block({ params: { id: 1 }, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'BLOCKED' }));
  });

  it('returns 404 for an unknown gift card', async () => {
    const res = mockRes();
    await giftCardController.block({ params: { id: 999 }, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids an owner blocking another owner\'s gift card', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await GiftCard.create({ id: 1, cinema_id: 1, code: 'A', initial_balance: 1000, remaining_balance: 1000 });
    const res = mockRes();
    await giftCardController.block({ params: { id: 1 }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
