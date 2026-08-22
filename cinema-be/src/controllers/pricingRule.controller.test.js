const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const pricingRuleController = require('./pricingRule.controller');
const PricingRule = require('../models/PricingRule');
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

describe('GET /api/pricingRule (list)', () => {
  it('scopes a branch admin to their own branches\' rules plus global ones', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await PricingRule.create([
      { id: 1, name: 'Mine', price: 1, branch_id: 1 },
      { id: 2, name: 'NotMine', price: 1, branch_id: 2 },
      { id: 3, name: 'Global', price: 1, branch_id: null },
    ]);
    const res = mockRes();
    await pricingRuleController.list(
      { query: {}, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it("filters a branch admin to -1 (no results) when requesting a branchId they don't own", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await pricingRuleController.list(
      { query: { branchId: '999' }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 0 }));
  });

  it('returns every rule for ALL scope with no branchId filter', async () => {
    await PricingRule.create([
      { id: 1, name: 'A', price: 1, branch_id: 1 },
      { id: 2, name: 'B', price: 1, branch_id: null },
    ]);
    const res = mockRes();
    await pricingRuleController.list({ query: {}, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });
});

describe('GET /api/pricingRule/:id (getById)', () => {
  it('returns 404 for an unknown rule', async () => {
    const res = mockRes();
    await pricingRuleController.getById({ params: { id: 999 }, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("forbids a branch admin reading another branch's rule", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await PricingRule.create({ id: 1, name: 'A', price: 1, branch_id: 1 });
    const res = mockRes();
    await pricingRuleController.getById(
      { params: { id: 1 }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('POST /api/pricingRule (create)', () => {
  it('rejects a missing name or price', async () => {
    const res = mockRes();
    await pricingRuleController.create({ body: {}, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an invalid room_type', async () => {
    const res = mockRes();
    await pricingRuleController.create(
      { body: { name: 'A', price: 1, room_type: 'BOGUS' }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a time_start without a matching time_end', async () => {
    const res = mockRes();
    await pricingRuleController.create(
      { body: { name: 'A', price: 1, time_start: '18:00' }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects time_start after time_end', async () => {
    const res = mockRes();
    await pricingRuleController.create(
      {
        body: { name: 'A', price: 1, time_start: '23:00', time_end: '18:00' },
        account: { role: 0 },
        permissionScope: 'ALL',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('only admin can create a branch-wide (system) rule', async () => {
    const res = mockRes();
    await pricingRuleController.create(
      { body: { name: 'Sys', price: 1 }, account: { role: 2, accountId: 1 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("forbids a branch admin creating a rule for a branch they don't own", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = mockRes();
    await pricingRuleController.create(
      {
        body: { name: 'A', price: 1, branch_id: 1 },
        account: { role: 2, accountId: 42 },
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("creates a rule for the branch admin's own branch", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await pricingRuleController.create(
      {
        body: { name: '2D Weekday', price: 80000, branch_id: 1, room_type: '2D', day_type: 'WEEKDAY' },
        account: { role: 2, accountId: 42 },
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await PricingRule.findOne({});
    expect(created.branch_id).toBe(1);
    expect(created.price).toBe(80000);
  });

  it('admin creates a system-wide rule', async () => {
    const res = mockRes();
    await pricingRuleController.create(
      { body: { name: 'Global', price: 50000 }, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await PricingRule.findOne({});
    expect(created.branch_id).toBeNull();
  });
});

describe('PUT /api/pricingRule/:id (update)', () => {
  it('returns 404 for an unknown rule', async () => {
    const res = mockRes();
    await pricingRuleController.update(
      { params: { id: 999 }, body: {}, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("forbids a branch admin updating another branch's rule", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await PricingRule.create({ id: 1, name: 'A', price: 1, branch_id: 1 });
    const res = mockRes();
    await pricingRuleController.update(
      { params: { id: 1 }, body: { price: 2 }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies only whitelisted fields', async () => {
    await PricingRule.create({ id: 1, name: 'A', price: 1, active: true });
    const res = mockRes();
    await pricingRuleController.update(
      {
        params: { id: 1 },
        body: { active: false, price: 999, id: 12345 },
        account: { role: 0 },
        permissionScope: 'ALL',
      },
      res,
    );
    const updated = await PricingRule.findOne({ id: 1 });
    expect(updated.active).toBe(false);
    expect(updated.price).toBe(999);
  });

  it('rejects making an out-of-enum change', async () => {
    await PricingRule.create({ id: 1, name: 'A', price: 1 });
    const res = mockRes();
    await pricingRuleController.update(
      { params: { id: 1 }, body: { day_type: 'BOGUS' }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects setting only time_start via a partial update when the existing rule has no time_end', async () => {
    await PricingRule.create({ id: 1, name: 'A', price: 1, time_start: null, time_end: null });
    const res = mockRes();
    await pricingRuleController.update(
      { params: { id: 1 }, body: { time_start: '18:00' }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('allows updating only time_start when the existing rule already has a time_end set', async () => {
    await PricingRule.create({ id: 1, name: 'A', price: 1, time_start: '10:00', time_end: '23:00' });
    const res = mockRes();
    await pricingRuleController.update(
      { params: { id: 1 }, body: { time_start: '18:00' }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
    const updated = await PricingRule.findOne({ id: 1 });
    expect(updated.time_start).toBe('18:00');
    expect(updated.time_end).toBe('23:00');
  });

  it('only admin can make a rule branch-wide (system) via update', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await PricingRule.create({ id: 1, name: 'A', price: 1, branch_id: 1 });
    const res = mockRes();
    await pricingRuleController.update(
      {
        params: { id: 1 },
        body: { branch_id: null },
        account: { role: 2, accountId: 42 },
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('DELETE /api/pricingRule/:id (remove)', () => {
  it('returns 404 for an unknown rule', async () => {
    const res = mockRes();
    await pricingRuleController.remove(
      { params: { id: 999 }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("forbids a branch admin removing another branch's rule", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await PricingRule.create({ id: 1, name: 'A', price: 1, branch_id: 1 });
    const res = mockRes();
    await pricingRuleController.remove(
      { params: { id: 1 }, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('removes the rule', async () => {
    await PricingRule.create({ id: 1, name: 'A', price: 1 });
    const res = mockRes();
    await pricingRuleController.remove({ params: { id: 1 }, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(await PricingRule.countDocuments()).toBe(0);
  });
});
