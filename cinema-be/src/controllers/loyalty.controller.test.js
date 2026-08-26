const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const loyaltyController = require('./loyalty.controller');
const Account = require('../models/Account');
const LoyaltyConfig = require('../models/LoyaltyConfig');
const PointsTransaction = require('../models/PointsTransaction');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('GET /api/loyalty/me (mySummary)', () => {
  it('returns the caller\'s membership summary', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 40, lifetime_points: 40 });
    const res = mockRes();
    await loyaltyController.mySummary({ account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ points_balance: 40 }));
  });

  it('404s for a missing account', async () => {
    const res = mockRes();
    await loyaltyController.mySummary({ account: { accountId: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('GET /api/loyalty/me/transactions (myTransactions)', () => {
  it('returns the caller\'s own paginated history', async () => {
    await PointsTransaction.create([
      { id: 1, account_id: 1, type: 'ADJUST', points: 1 },
      { id: 2, account_id: 2, type: 'ADJUST', points: 2 },
    ]);
    const res = mockRes();
    await loyaltyController.myTransactions({ account: { accountId: 1 }, query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});

describe('POST /api/loyalty/redeem (redeem)', () => {
  it('redeems points and returns 201', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 500 });
    const res = mockRes();
    await loyaltyController.redeem({ account: { accountId: 1 }, body: { points: 200 } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 with an error code when redemption is invalid', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 10 });
    const res = mockRes();
    await loyaltyController.redeem({ account: { accountId: 1 }, body: { points: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSUFFICIENT_POINTS' }));
  });
});

describe('GET/PUT /api/loyalty/config', () => {
  it('getConfigHandler returns the current (or default) config', async () => {
    const res = mockRes();
    await loyaltyController.getConfigHandler({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ amount_per_point: 10000 }));
  });

  it('updateConfigHandler applies valid updates', async () => {
    const res = mockRes();
    await loyaltyController.updateConfigHandler(
      { account: { accountId: 1 }, body: { amount_per_point: 5000 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ amount_per_point: 5000 }));
    expect(await LoyaltyConfig.countDocuments()).toBe(1);
  });

  it('updateConfigHandler rejects a non-positive amount_per_point', async () => {
    const res = mockRes();
    await loyaltyController.updateConfigHandler({ account: { accountId: 1 }, body: { amount_per_point: 0 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(await LoyaltyConfig.countDocuments()).toBe(0);
  });

  it('updateConfigHandler rejects a negative min_redeem_points', async () => {
    const res = mockRes();
    await loyaltyController.updateConfigHandler({ account: { accountId: 1 }, body: { min_redeem_points: -1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('POST /api/loyalty/:accountId/adjust', () => {
  it('applies a manual adjustment and returns 201', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const res = mockRes();
    await loyaltyController.adjust({ account: { accountId: 9 }, params: { accountId: '1' }, body: { amount: 25 } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect((await Account.findOne({ id: 1 })).points_balance).toBe(25);
  });

  it('404s for a missing target account', async () => {
    const res = mockRes();
    await loyaltyController.adjust({ account: { accountId: 9 }, params: { accountId: '999' }, body: { amount: 25 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
