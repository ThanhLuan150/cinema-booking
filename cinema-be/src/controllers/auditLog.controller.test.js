const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const auditLogController = require('./auditLog.controller');
const auditLogRepository = require('../repositories/auditLog.repository');
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

async function seedTrail() {
  await auditLogRepository.create({ entityType: 'BRANCH', entityId: 1, action: 'CREATE_BRANCH', performedBy: 1, branchId: 1 });
  await auditLogRepository.create({ entityType: 'BOOKING', entityId: 2, action: 'CREATE_BOOKING', performedBy: 2, branchId: 2 });
  await auditLogRepository.create({ entityType: 'MOVIE', entityId: 3, action: 'CREATE_MOVIE', performedBy: 1, branchId: null });
}

describe('auditLog.controller.list', () => {
  it('an ALL-scope caller sees the whole system', async () => {
    await seedTrail();
    const res = mockRes();
    await auditLogController.list({ permissionScope: 'ALL', query: {}, account: { accountId: 1 } }, res);
    expect(res.json.mock.calls[0][0].total).toBe(3);
  });

  it('an ALL-scope caller may narrow to one branch via ?branchId', async () => {
    await seedTrail();
    const res = mockRes();
    await auditLogController.list({ permissionScope: 'ALL', query: { branchId: '2' }, account: { accountId: 1 } }, res);
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.data[0].branch_id).toBe(2);
  });

  it('a BRANCH-scope caller is restricted to req.branchId set by the route', async () => {
    await seedTrail();
    const res = mockRes();
    await auditLogController.list(
      { permissionScope: 'BRANCH', branchId: 1, query: {}, account: { accountId: 1 } },
      res,
    );
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.data[0].branch_id).toBe(1);
  });

  it('a BRANCH-scope caller with no branchId falls back to branches they own — never system-wide rows', async () => {
    await seedTrail();
    await Branch.create({ id: 2, company_id: 1, owner_id: 77, name: 'B2', code: 'B2' });
    const res = mockRes();
    await auditLogController.list(
      { permissionScope: 'BRANCH', query: {}, account: { accountId: 77 } },
      res,
    );
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.data[0].branch_id).toBe(2);
  });

  it('applies entityType / action filters on top of the scope', async () => {
    await seedTrail();
    const res = mockRes();
    await auditLogController.list(
      { permissionScope: 'ALL', query: { action: 'CREATE_MOVIE' }, account: { accountId: 1 } },
      res,
    );
    expect(res.json.mock.calls[0][0].total).toBe(1);
  });
});

describe('auditLog.controller.meta', () => {
  it('returns the action + entity-type vocabulary', async () => {
    const res = mockRes();
    await auditLogController.meta({}, res);
    const body = res.json.mock.calls[0][0];
    expect(body.actions).toEqual(expect.arrayContaining(['CREATE_BRANCH', 'TICKET_CHECKIN', 'PAYMENT_FAILED']));
    expect(body.entityTypes).toEqual(expect.arrayContaining(['BRANCH', 'TICKET']));
  });
});

describe('auditLog.controller.getById', () => {
  it('404s an unknown id', async () => {
    const res = mockRes();
    await auditLogController.getById({ permissionScope: 'ALL', params: { id: 999 }, query: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids a BRANCH caller from reading another branch\'s row', async () => {
    await seedTrail();
    await Branch.create({ id: 1, company_id: 1, owner_id: 5, name: 'B1', code: 'B1' });
    const res = mockRes();
    // row id 2 belongs to branch 2; caller owns branch 1 only
    await auditLogController.getById(
      { permissionScope: 'BRANCH', params: { id: 2 }, query: {}, account: { accountId: 5 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
