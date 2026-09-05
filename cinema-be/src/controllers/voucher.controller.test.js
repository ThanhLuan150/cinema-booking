const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const voucherController = require('./voucher.controller');
const Voucher = require('../models/Voucher');
const VoucherUsage = require('../models/VoucherUsage');
const Branch = require('../models/Branch');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Combo = require('../models/Combo');

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
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Voucher.create([
      { id: 1, cinema_id: 1, code: 'MINE', discount_type: 'FIXED_AMOUNT', discount_value: 1000 },
      { id: 2, cinema_id: 2, code: 'NOTMINE', discount_type: 'FIXED_AMOUNT', discount_value: 1000 },
    ]);
    const res = mockRes();
    await voucherController.list({ query: {}, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('filters an owner to -1 (no results) when requesting a branchId they don\'t own', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Voucher.create({ id: 1, cinema_id: 1, code: 'MINE', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    const res = mockRes();
    await voucherController.list(
      { query: { branchId: '999' }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }));
  });

  it('returns all vouchers for admin with no branchId filter', async () => {
    await Voucher.create([
      { id: 1, cinema_id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 },
      { id: 2, code: 'B', discount_type: 'FIXED_AMOUNT', discount_value: 1000 },
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
      { body: { code: 'SYS', discount_type: 'FIXED_AMOUNT', discount_value: 1000 }, account: { role: 2, accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids an owner creating a voucher for a cinema they do not own', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = mockRes();
    await voucherController.create(
      { body: { cinema_id: 1, code: 'X', discount_type: 'FIXED_AMOUNT', discount_value: 1000 }, account: { role: 2, accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('creates a voucher for the owner\'s own cinema', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await voucherController.create(
      { body: { cinema_id: 1, code: 'promo', discount_type: 'FIXED_AMOUNT', discount_value: 1000 }, account: { role: 2, accountId: 42 } },
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
        body: { code: 'SYS', discount_type: 'PERCENTAGE', discount_value: 10 },
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
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Voucher.create({ id: 1, cinema_id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    const res = mockRes();
    await voucherController.update(
      { params: { id: 1 }, body: { active: false }, account: { role: 2, accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies only whitelisted fields', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000, active: true });
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
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Voucher.create({ id: 1, cinema_id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    const res = mockRes();
    await voucherController.remove({ params: { id: 1 }, account: { role: 2, accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('removes the voucher', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
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
      discount_type: 'FIXED_AMOUNT',
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
      discount_type: 'FIXED_AMOUNT',
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
      discount_type: 'FIXED_AMOUNT',
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
      discount_type: 'FIXED_AMOUNT',
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
      discount_type: 'FIXED_AMOUNT',
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
      discount_type: 'FIXED_AMOUNT',
      discount_value: 10000,
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'fixed10k', order_value: 100000 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ discount_type: 'FIXED_AMOUNT', discount_value: 10000, discount_amount: 10000 }),
    );
  });

  it('computes a rounded percent discount amount', async () => {
    await Voucher.create({
      id: 1,
      code: 'SAVE15',
      discount_type: 'PERCENTAGE',
      discount_value: 15,
    });
    const res = mockRes();
    await voucherController.validate({ body: { code: 'SAVE15', order_value: 99999 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ discount_amount: Math.round((99999 * 15) / 100) }),
    );
  });

  describe('FREE_TICKET / FREE_COMBO', () => {
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
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 1, seat_type: 1 }, // vip, pricier
      ]);
      await Combo.create([
        { id: 1, cinema_id: 5, name: 'Small', price: 40000 },
        { id: 2, cinema_id: 5, name: 'Large', price: 70000 },
      ]);
    }

    it('requires ticket_ids to preview a FREE_TICKET voucher', async () => {
      await Voucher.create({ id: 1, code: 'FREE1', discount_type: 'FREE_TICKET', discount_value: 0, free_quantity: 1 });
      const res = mockRes();
      await voucherController.validate({ body: { code: 'FREE1', order_value: 100000 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_TICKET_CONTEXT_REQUIRED' }));
    });

    it('waives the cheapest ticket for a FREE_TICKET voucher, computed from real ticket ids', async () => {
      await seedOrder();
      await Voucher.create({ id: 1, code: 'FREE1', discount_type: 'FREE_TICKET', discount_value: 0, free_quantity: 1 });
      const res = mockRes();
      await voucherController.validate({ body: { code: 'FREE1', ticket_ids: [1, 2] } }, res);
      // Regular seat (100000) is cheaper than VIP (120000) -> the regular one is waived.
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ discount_amount: 100000 }));
    });

    it('rejects a FREE_COMBO voucher when the order has no eligible combo', async () => {
      await seedOrder();
      await Voucher.create({ id: 1, code: 'FREEBO', discount_type: 'FREE_COMBO', discount_value: 0, free_quantity: 1 });
      const res = mockRes();
      await voucherController.validate({ body: { code: 'FREEBO', ticket_ids: [1], combo_ids: [] } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_COMBO_NOT_ELIGIBLE' }));
    });

    it('waives the cheapest combo for a FREE_COMBO voucher with no target combo_id', async () => {
      await seedOrder();
      await Voucher.create({ id: 1, code: 'FREEBO', discount_type: 'FREE_COMBO', discount_value: 0, free_quantity: 1 });
      const res = mockRes();
      await voucherController.validate({ body: { code: 'FREEBO', ticket_ids: [1], combo_ids: [1, 2] } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ discount_amount: 40000 }));
    });
  });
});

describe('GET /api/voucher/:id/history', () => {
  it('returns 404 for an unknown voucher', async () => {
    const res = mockRes();
    await voucherController.history({ params: { id: 999 }, query: {}, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("forbids an owner viewing another owner's cinema voucher history", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Voucher.create({ id: 1, cinema_id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    const res = mockRes();
    await voucherController.history({ params: { id: 1 }, query: {}, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns the usage history for the voucher', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    await VoucherUsage.create({ id: 1, voucher_id: 1, account_id: 42, discount_amount: 1000 });
    const res = mockRes();
    await voucherController.history({ params: { id: 1 }, query: {}, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});

describe('POST /api/voucher — new discount types & duplicate code', () => {
  it('rejects a PERCENTAGE discount_value outside 1-100', async () => {
    const res = mockRes();
    await voucherController.create(
      { body: { code: 'BAD', discount_type: 'PERCENTAGE', discount_value: 150 }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('requires free_quantity for a FREE_TICKET voucher', async () => {
    const res = mockRes();
    await voucherController.create(
      { body: { code: 'FREE1', discount_type: 'FREE_TICKET' }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a FREE_COMBO voucher targeting a specific combo', async () => {
    const res = mockRes();
    await voucherController.create(
      {
        body: { code: 'FREEBO', discount_type: 'FREE_COMBO', free_quantity: 2, combo_id: 5 },
        account: { role: 0 },
        permissionScope: 'ALL',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Voucher.findOne({});
    expect(created.free_quantity).toBe(2);
    expect(created.combo_id).toBe(5);
    expect(created.discount_value).toBe(0);
  });

  it('rejects creating a voucher with a code that already exists', async () => {
    await Voucher.create({ id: 1, code: 'DUP', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    const res = mockRes();
    await voucherController.create(
      { body: { code: 'dup', discount_type: 'FIXED_AMOUNT', discount_value: 500 }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VOUCHER_CODE_EXISTS' }));
  });
});
