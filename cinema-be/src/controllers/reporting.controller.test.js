const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const reportingController = require('./reporting.controller');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const Branch = require('../models/Branch');
const Movie = require('../models/Movie');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const SUPER_ADMIN = { role: 0, accountId: 1 };
const BRANCH_ADMIN = { role: 2, accountId: 42 };
const CUSTOMER = { role: 1, accountId: 7 };

describe('reporting.controller.financial — authorization', () => {
  it('rejects a caller whose permission scope is OWN (customer)', async () => {
    const res = mockRes();
    await reportingController.financial({ query: {}, account: CUSTOMER, permissionScope: 'OWN' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ totals: expect.anything() }));
  });

  it('rejects a caller with no resolvable scope', async () => {
    const res = mockRes();
    await reportingController.financial({ query: {}, account: CUSTOMER, permissionScope: undefined }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('gives a super admin (ALL) system-wide numbers including movieCount', async () => {
    await Movie.create([
      { id: 1, name: 'A', premiere_date: '2025-01-01', status: 'ACTIVE' },
      { id: 2, name: 'B', premiere_date: '2025-01-01', status: 'ACTIVE' },
    ]);
    const res = mockRes();
    await reportingController.financial({ query: {}, account: SUPER_ADMIN, permissionScope: 'ALL' }, res);
    const [payload] = res.json.mock.calls[0];
    expect(payload.scope).toBe('ALL');
    expect(payload.branchIds).toBeNull();
    expect(payload.totals.movieCount).toBe(2);
  });

  it('forces a branch admin to their own branch and nulls movieCount', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'M' });
    const res = mockRes();
    await reportingController.financial({ query: {}, account: BRANCH_ADMIN, permissionScope: 'BRANCH' }, res);
    const [payload] = res.json.mock.calls[0];
    expect(payload.scope).toBe('BRANCH');
    expect(payload.branchIds).toEqual([1]);
    expect(payload.totals.movieCount).toBeNull();
  });

  it('rejects a branch admin asking for a branch they do not own', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'M' },
      { id: 2, company_id: 1, owner_id: 99, name: 'Theirs', code: 'T' },
    ]);
    const res = mockRes();
    await reportingController.financial(
      { query: { branchId: '2' }, account: BRANCH_ADMIN, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects a super admin asking for a branch that does not exist', async () => {
    const res = mockRes();
    await reportingController.financial(
      { query: { branchId: '404' }, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('reporting.controller.operational', () => {
  it('returns branch-scoped counters narrowed to the employee\'s Position', async () => {
    await seedRbac();
    await seedPositions();
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'M' });
    const comboStaff = await Position.findOne({ code: 'COMBO_STAFF' });
    // resolveAccessibleBranchIds falls back to the employee's staffed branch
    await Employee.create({ id: 1, user_id: 55, branch_id: 1, employee_code: 'E1', position_id: comboStaff.id, status: 1 });

    const res = mockRes();
    await reportingController.operational(
      { query: {}, account: { role: 3, accountId: 55 }, permissionScope: 'BRANCH' },
      res,
    );
    const [payload] = res.json.mock.calls[0];
    expect(payload.scope).toBe('BRANCH');
    expect(payload.branchIds).toEqual([1]);
    expect(payload.positionCode).toBe('COMBO_STAFF');
    // Combo Staff runs the counter queue; they have no business seeing check-in throughput.
    expect(payload.metrics).toHaveProperty('pendingComboOrders');
    expect(payload.metrics).not.toHaveProperty('ticketsCheckedInToday');
  });

  it('never leaks a money field on the operational report', async () => {
    await seedRbac();
    await seedPositions();
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'M' });
    const checker = await Position.findOne({ code: 'TICKET_CHECKER' });
    await Employee.create({ id: 1, user_id: 55, branch_id: 1, employee_code: 'E1', position_id: checker.id, status: 1 });

    const res = mockRes();
    await reportingController.operational(
      { query: {}, account: { role: 3, accountId: 55 }, permissionScope: 'BRANCH' },
      res,
    );
    const [payload] = res.json.mock.calls[0];
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/revenue|discount|refund|netRevenue|amount/i);
  });

  it('rejects a customer', async () => {
    const res = mockRes();
    await reportingController.operational({ query: {}, account: CUSTOMER, permissionScope: 'OWN' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
