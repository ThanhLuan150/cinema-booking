const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const voucherController = require('./voucher.controller');
const Voucher = require('../models/Voucher');
const Cinema = require('../models/Cinema');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('GET /api/voucher (list)', () => {
  it('scopes an owner (role 2) to vouchers on their own cinemas', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    await Voucher.create([
      { id: 1, cinema_id: 1, code: 'MINE', discount_type: 'fixed', discount_value: 1000 },
      { id: 2, cinema_id: 2, code: 'NOTMINE', discount_type: 'fixed', discount_value: 1000 },
    ]);
    const res = mockRes();
    await voucherController.list({ query: {}, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('filters an owner to -1 (no results) when requesting a cinemaId they don\'t own', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    await Voucher.create({ id: 1, cinema_id: 1, code: 'MINE', discount_type: 'fixed', discount_value: 1000 });
    const res = mockRes();
    await voucherController.list(
      { query: { cinemaId: '999' }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }));
  });

  it('returns all vouchers for admin with no cinemaId filter', async () => {
    await Voucher.create([
      { id: 1, cinema_id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000 },
      { id: 2, code: 'B', discount_type: 'fixed', discount_value: 1000 },
    ]);
    const res = mockRes();
    await voucherController.list({ query: {}, account: { role: 0, accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });
});

describe('POST /api/voucher (create)', () => {
  it('rejects missing code, discount_type or discount_value', async () => {
    const res = mockRes();
    await voucherController.create({ body: {}, account: { role: 0 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('only admin can create system-wide (cinema_id null) vouchers', async () => {
    const res = mockRes();
    await voucherController.create(
      { body: { code: 'SYS', discount_type: 'fixed', discount_value: 1000 }, account: { role: 2, accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids an owner creating a voucher for a cinema they do not own', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = mockRes();
    await voucherController.create(
      { body: { cinema_id: 1, code: 'X', discount_type: 'fixed', discount_value: 1000 }, account: { role: 2, accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('creates a voucher for the owner\'s own cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = mockRes();
    await voucherController.create(
      { body: { cinema_id: 1, code: 'promo', discount_type: 'fixed', discount_value: 1000 }, account: { role: 2, accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Voucher.findOne({});
    expect(created.code).toBe('PROMO');
  });

  it('admin creates a system-wide voucher', async () => {
    const res = mockRes();
    await voucherController.create(
      {
        body: { code: 'SYS', discount_type: 'percent', discount_value: 10 },
        account: { role: 0, accountId: 1 },
        permissionScope: 'ALL',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Voucher.findOne({});
    expect(created.cinema_id).toBeNull();
  });
});

describe('PUT /api/voucher/:id (update)', () => {
  it('returns 404 for an unknown voucher', async () => {
    const res = mockRes();
    await voucherController.update({ params: { id: 999 }, body: {}, account: { role: 0 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids an owner updating another owner\'s cinema voucher', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    await Voucher.create({ id: 1, cinema_id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000 });
    const res = mockRes();
    await voucherController.update(
      { params: { id: 1 }, body: { active: false }, account: { role: 2, accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies only whitelisted fields', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000, active: true });
    const res = mockRes();
    await voucherController.update(
      { params: { id: 1 }, body: { active: false, code: 'HACKED' }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    const updated = await Voucher.findOne({ id: 1 });
    expect(updated.active).toBe(false);
    expect(updated.code).toBe('A');
  });
});

describe('DELETE /api/voucher/:id (remove)', () => {
  it('returns 404 for an unknown voucher', async () => {
    const res = mockRes();
    await voucherController.remove({ params: { id: 999 }, account: { role: 0 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids an owner removing another owner\'s cinema voucher', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    await Voucher.create({ id: 1, cinema_id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000 });
    const res = mockRes();
    await voucherController.remove({ params: { id: 1 }, account: { role: 2, accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('removes the voucher', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000 });
    const res = mockRes();
    await voucherController.remove({ params: { id: 1 }, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(await Voucher.countDocuments()).toBe(0);
  });
});

describe('POST /api/voucher/validate', () => {
  it('rejects a request with no code', async () => {
    const res = mockRes();
    await voucherController.validate({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for an unknown code', async () => {
    const res = mockRes();
    await voucherController.validate({ body: { code: 'NOPE' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_NOT_FOUND' }));
  });

  it('rejects a cinema-scoped voucher used for a different cinema', async () => {
    await Voucher.create({
      id: 1,
      cinema_id: 5,
      code: 'SAVE10',
      discount_type: 'fixed',
      discount_value: 10000,
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'SAVE10', cinema_id: 6, order_value: 100000 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_WRONG_CINEMA' }));
  });

  it('rejects a voucher that is not yet valid', async () => {
    await Voucher.create({
      id: 1,
      code: 'FUTURE',
      discount_type: 'fixed',
      discount_value: 10000,
      valid_from: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'FUTURE', order_value: 100000 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_NOT_YET_VALID' }));
  });

  it('rejects an expired voucher', async () => {
    await Voucher.create({
      id: 1,
      code: 'EXPIRED',
      discount_type: 'fixed',
      discount_value: 10000,
      valid_to: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'EXPIRED', order_value: 100000 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_EXPIRED' }));
  });

  it('rejects a voucher that has reached its usage limit', async () => {
    await Voucher.create({
      id: 1,
      code: 'MAXED',
      discount_type: 'fixed',
      discount_value: 10000,
      max_uses: 5,
      used_count: 5,
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'MAXED', order_value: 100000 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_USES_EXHAUSTED' }));
  });

  it('rejects an order below the minimum order value', async () => {
    await Voucher.create({
      id: 1,
      code: 'MIN50K',
      discount_type: 'fixed',
      discount_value: 10000,
      min_order_value: 50000,
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'MIN50K', order_value: 20000 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VOUCHER_MIN_ORDER_NOT_MET', minOrderValue: 50000 }),
    );
  });

  it('computes a fixed discount amount', async () => {
    await Voucher.create({
      id: 1,
      code: 'FIXED10K',
      discount_type: 'fixed',
      discount_value: 10000,
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'fixed10k', order_value: 100000 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ discount_type: 'fixed', discount_value: 10000, discount_amount: 10000 }),
    );
  });

  it('computes a rounded percent discount amount', async () => {
    await Voucher.create({
      id: 1,
      code: 'SAVE15',
      discount_type: 'percent',
      discount_value: 15,
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'SAVE15', order_value: 99999 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ discount_amount: Math.round((99999 * 15) / 100) }),
    );
  });
});
