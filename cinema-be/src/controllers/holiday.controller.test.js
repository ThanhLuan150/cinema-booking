const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const holidayController = require('./holiday.controller');
const Holiday = require('../models/Holiday');
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

describe('GET /api/pricingHoliday (list)', () => {
  it("scopes a branch admin to their own branches' holidays plus global ones", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Holiday.create([
      { id: 1, date: '2026-01-01', branch_id: 1 },
      { id: 2, date: '2026-01-01', branch_id: 2 },
      { id: 3, date: '2026-12-25', branch_id: null },
    ]);
    const res = mockRes();
    await holidayController.list({ query: {}, account: { role: 2, accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });
});

describe('POST /api/pricingHoliday (create)', () => {
  it('rejects a missing or malformed date', async () => {
    const res = mockRes();
    await holidayController.create({ body: {}, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await holidayController.create(
      { body: { date: '01-01-2026' }, account: { role: 0 }, permissionScope: 'ALL' },
      res2,
    );
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('only admin can create a branch-wide (system) holiday', async () => {
    const res = mockRes();
    await holidayController.create(
      { body: { date: '2026-01-01' }, account: { role: 2, accountId: 1 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("forbids a branch admin creating a holiday for a branch they don't own", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = mockRes();
    await holidayController.create(
      {
        body: { date: '2026-01-01', branch_id: 1 },
        account: { role: 2, accountId: 42 },
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('creates a holiday', async () => {
    const res = mockRes();
    await holidayController.create(
      { body: { date: '2026-01-01', name: "New Year's" }, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects a duplicate (date, branch) pair with 409', async () => {
    await Holiday.create({ id: 1, date: '2026-01-01', branch_id: null });
    const res = mockRes();
    await holidayController.create(
      { body: { date: '2026-01-01' }, account: { role: 0, accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'HOLIDAY_DUPLICATE' }));
  });
});

describe('PUT /api/pricingHoliday/:id (update)', () => {
  it('returns 404 for an unknown holiday', async () => {
    const res = mockRes();
    await holidayController.update(
      { params: { id: 999 }, body: {}, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('applies only whitelisted fields', async () => {
    await Holiday.create({ id: 1, date: '2026-01-01', name: 'A' });
    const res = mockRes();
    await holidayController.update(
      {
        params: { id: 1 },
        body: { name: 'Updated', branch_id: 999 },
        account: { role: 0 },
        permissionScope: 'ALL',
      },
      res,
    );
    const updated = await Holiday.findOne({ id: 1 });
    expect(updated.name).toBe('Updated');
    expect(updated.branch_id).toBeNull();
  });
});

describe('DELETE /api/pricingHoliday/:id (remove)', () => {
  it('returns 404 for an unknown holiday', async () => {
    const res = mockRes();
    await holidayController.remove(
      { params: { id: 999 }, account: { role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removes the holiday', async () => {
    await Holiday.create({ id: 1, date: '2026-01-01' });
    const res = mockRes();
    await holidayController.remove({ params: { id: 1 }, account: { role: 0 }, permissionScope: 'ALL' }, res);
    expect(await Holiday.countDocuments()).toBe(0);
  });
});
