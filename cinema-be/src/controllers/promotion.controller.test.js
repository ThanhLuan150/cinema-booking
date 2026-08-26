const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const promotionController = require('./promotion.controller');
const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');
const Branch = require('../models/Branch');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

function baseFields(overrides = {}) {
  return {
    name: 'Promo',
    discount_type: 'FIXED_AMOUNT',
    discount_value: 1000,
    start_at: PAST,
    end_at: FUTURE,
    ...overrides,
  };
}

const validBody = () => ({
  code: 'PROMO',
  name: 'Promo',
  discount_type: 'FIXED_AMOUNT',
  discount_value: 1000,
  start_at: PAST.toISOString(),
  end_at: FUTURE.toISOString(),
});

describe('GET /api/promotion (list)', () => {
  it('scopes an owner (BRANCH) to promotions on their own branches plus system-wide ones', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Promotion.create([
      baseFields({ id: 1, code: 'MINE', branch_ids: [1] }),
      baseFields({ id: 2, code: 'NOTMINE', branch_ids: [2] }),
      baseFields({ id: 3, code: 'GLOBAL' }),
    ]);
    const res = mockRes();
    await promotionController.list({ query: {}, account: { accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('filters to -1 (no results) when requesting a branchId the owner does not own', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Promotion.create(baseFields({ id: 1, code: 'MINE', branch_ids: [1] }));
    const res = mockRes();
    await promotionController.list(
      { query: { branchId: '999' }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }));
  });

  it('returns everything for ALL scope with no branchId filter', async () => {
    await Promotion.create([baseFields({ id: 1, code: 'A', branch_ids: [1] }), baseFields({ id: 2, code: 'B' })]);
    const res = mockRes();
    await promotionController.list({ query: {}, account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('filters by status', async () => {
    await Promotion.create([
      baseFields({ id: 1, code: 'A', status: 'ACTIVE' }),
      baseFields({ id: 2, code: 'B', status: 'INACTIVE' }),
    ]);
    const res = mockRes();
    await promotionController.list(
      { query: { status: 'INACTIVE' }, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});

describe('GET /api/promotion/:id (getById)', () => {
  it('returns 404 for an unknown promotion', async () => {
    const res = mockRes();
    await promotionController.getById({ params: { id: 999 }, account: {}, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids a BRANCH-scope caller viewing a promotion scoped to a branch they do not own', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Promotion.create(baseFields({ id: 1, code: 'A', branch_ids: [1] }));
    const res = mockRes();
    await promotionController.getById(
      { params: { id: 1 }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a BRANCH-scope caller to view a system-wide promotion', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'A' }));
    const res = mockRes();
    await promotionController.getById(
      { params: { id: 1 }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'A' }));
  });
});

describe('POST /api/promotion (create)', () => {
  it('rejects missing required fields', async () => {
    const res = mockRes();
    await promotionController.create({ body: {}, account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a percentage discount above 100', async () => {
    const res = mockRes();
    await promotionController.create(
      { body: { ...validBody(), discount_type: 'PERCENTAGE', discount_value: 150 }, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects start_at not before end_at', async () => {
    const res = mockRes();
    await promotionController.create(
      { body: { ...validBody(), start_at: '2026-02-01', end_at: '2026-01-01' }, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a duplicate code', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'PROMO' }));
    const res = mockRes();
    await promotionController.create({ body: validBody(), account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROMOTION_CODE_EXISTS' }));
  });

  it('only admin (ALL scope) can create a system-wide promotion', async () => {
    const res = mockRes();
    await promotionController.create({ body: validBody(), account: { accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids a BRANCH-scope caller creating a promotion for a branch they do not own', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = mockRes();
    await promotionController.create(
      { body: { ...validBody(), branch_ids: [1] }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('creates a promotion scoped to the caller\'s own branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await promotionController.create(
      { body: { ...validBody(), branch_ids: [1] }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Promotion.findOne({});
    expect(created.code).toBe('PROMO');
    expect(created.branch_ids).toEqual([1]);
  });

  it('admin creates a system-wide promotion', async () => {
    const res = mockRes();
    await promotionController.create({ body: validBody(), account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Promotion.findOne({});
    expect(created.branch_ids).toEqual([]);
  });
});

describe('PUT /api/promotion/:id (update)', () => {
  it('returns 404 for an unknown promotion', async () => {
    const res = mockRes();
    await promotionController.update({ params: { id: 999 }, body: {}, account: {}, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids an owner updating another owner\'s branch promotion', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Promotion.create(baseFields({ id: 1, code: 'A', branch_ids: [1] }));
    const res = mockRes();
    await promotionController.update(
      { params: { id: 1 }, body: { status: 'INACTIVE' }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies only whitelisted fields', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'A', status: 'ACTIVE' }));
    const res = mockRes();
    await promotionController.update(
      { params: { id: 1 }, body: { status: 'INACTIVE', code: 'HACKED' }, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    const updated = await Promotion.findOne({ id: 1 });
    expect(updated.status).toBe('INACTIVE');
    expect(updated.code).toBe('A');
  });

  it('rejects an invalid discount_value on update', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'A' }));
    const res = mockRes();
    await promotionController.update(
      { params: { id: 1 }, body: { discount_value: -5 }, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('forbids widening branch_ids to branches the caller does not own', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Branch.create({ id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' });
    await Promotion.create(baseFields({ id: 1, code: 'A', branch_ids: [1] }));
    const res = mockRes();
    await promotionController.update(
      { params: { id: 1 }, body: { branch_ids: [1, 2] }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids a BRANCH-scope caller clearing branch_ids to make a promotion system-wide', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Promotion.create(baseFields({ id: 1, code: 'A', branch_ids: [1] }));
    const res = mockRes();
    await promotionController.update(
      { params: { id: 1 }, body: { branch_ids: [] }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('DELETE /api/promotion/:id (remove)', () => {
  it('returns 404 for an unknown promotion', async () => {
    const res = mockRes();
    await promotionController.remove({ params: { id: 999 }, account: {}, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids an owner removing another owner\'s branch promotion', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Promotion.create(baseFields({ id: 1, code: 'A', branch_ids: [1] }));
    const res = mockRes();
    await promotionController.remove(
      { params: { id: 1 }, account: { accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('removes the promotion', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'A' }));
    const res = mockRes();
    await promotionController.remove({ params: { id: 1 }, account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(await Promotion.countDocuments()).toBe(0);
  });
});

describe('POST /api/promotion/validate', () => {
  it('rejects a request with no code', async () => {
    const res = mockRes();
    await promotionController.validate({ body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for an unknown code', async () => {
    const res = mockRes();
    await promotionController.validate({ body: { code: 'NOPE' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROMOTION_NOT_FOUND' }));
  });

  it('rejects an inactive promotion', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'INACTIVE1', status: 'INACTIVE' }));
    const res = mockRes();
    await promotionController.validate({ body: { code: 'INACTIVE1', order_value: 100000 }, account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROMOTION_INACTIVE' }));
  });

  it('rejects a branch-restricted promotion used at a different branch', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'BRANCHED', branch_ids: [5] }));
    const res = mockRes();
    await promotionController.validate(
      { body: { code: 'BRANCHED', branch_id: 6, order_value: 100000 }, account: { accountId: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROMOTION_BRANCH_NOT_ELIGIBLE' }));
  });

  it('rejects an order below the minimum order value', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'MIN50K', minimum_order_value: 50000 }));
    const res = mockRes();
    await promotionController.validate(
      { body: { code: 'MIN50K', order_value: 20000 }, account: { accountId: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROMOTION_MIN_ORDER_NOT_MET', minimumOrderValue: 50000 }),
    );
  });

  it('rejects a customer who already reached their per-customer limit', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'ONCE', per_customer_limit: 1 }));
    await PromotionUsage.create({ promotion_id: 1, account_id: 7, count: 1 });
    const res = mockRes();
    await promotionController.validate(
      { body: { code: 'ONCE', order_value: 100000 }, account: { accountId: 7 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROMOTION_CUSTOMER_LIMIT_REACHED' }));
  });

  it('computes a fixed discount amount without consuming a use', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'FIXED10K', discount_value: 10000 }));
    const res = mockRes();
    await promotionController.validate(
      { body: { code: 'fixed10k', order_value: 100000 }, account: { accountId: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ discount_type: 'FIXED_AMOUNT', discount_value: 10000, discount_amount: 10000 }),
    );
    expect((await Promotion.findOne({ id: 1 })).used_count).toBe(0);
    expect(await PromotionUsage.countDocuments({ promotion_id: 1 })).toBe(0);
  });

  it('computes a rounded, capped percentage discount', async () => {
    await Promotion.create(
      baseFields({ id: 1, code: 'SAVE50', discount_type: 'PERCENTAGE', discount_value: 50, maximum_discount: 20000 }),
    );
    const res = mockRes();
    await promotionController.validate(
      { body: { code: 'SAVE50', order_value: 100000 }, account: { accountId: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ discount_amount: 20000 }));
  });
});

describe('POST /api/promotion/apply', () => {
  it('rejects an ineligible promotion without recording usage', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'MAXED', usage_limit: 1, used_count: 1 }));
    const res = mockRes();
    await promotionController.apply(
      { body: { code: 'MAXED', order_value: 100000 }, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect((await Promotion.findOne({ id: 1 })).used_count).toBe(1);
  });

  it('records usage and returns the computed discount on success', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'APPLYME', discount_value: 5000 }));
    const res = mockRes();
    await promotionController.apply(
      { body: { code: 'APPLYME', order_value: 100000 }, account: { accountId: 7 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ discount_amount: 5000 }));
    expect((await Promotion.findOne({ id: 1 })).used_count).toBe(1);
    expect((await PromotionUsage.findOne({ promotion_id: 1, account_id: 7 })).count).toBe(1);
  });

  it('enforces the per-customer limit across repeated apply calls', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'ONCE', per_customer_limit: 1 }));
    const res1 = mockRes();
    await promotionController.apply({ body: { code: 'ONCE', order_value: 100000 }, account: { accountId: 7 } }, res1);
    expect(res1.status).not.toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await promotionController.apply({ body: { code: 'ONCE', order_value: 100000 }, account: { accountId: 7 } }, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROMOTION_CUSTOMER_LIMIT_REACHED' }));
  });
});
