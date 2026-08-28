const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const systemConfigController = require('./systemConfig.controller');
const systemConfigService = require('../services/systemConfig.service');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  systemConfigService.invalidateAll();
});
afterAll(async () => closeDatabase());

const SUPER_ADMIN = { role: 0, accountId: 1 };
const BRANCH_ADMIN = { role: 2, accountId: 42 };

describe('systemConfig.controller — meta', () => {
  it('returns the registry metadata', async () => {
    const res = mockRes();
    await systemConfigController.meta({}, res);
    const [payload] = res.json.mock.calls[0];
    expect(payload.settings.map((s) => s.key)).toContain('BOOKING_HOLD_TIME');
  });
});

describe('systemConfig.controller — list', () => {
  it('ALL scope with no branchId returns the Global Settings view', async () => {
    const res = mockRes();
    await systemConfigController.list(
      { query: {}, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: null, settings: expect.any(Array) }),
    );
  });

  it('BRANCH scope with no branchId is rejected', async () => {
    const res = mockRes();
    await systemConfigController.list(
      { query: {}, account: BRANCH_ADMIN, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("BRANCH scope requesting a branch it doesn't own is forbidden", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = mockRes();
    await systemConfigController.list(
      { query: { branchId: '1' }, account: BRANCH_ADMIN, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('BRANCH scope requesting its own branch succeeds', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await systemConfigController.list(
      { query: { branchId: '1' }, account: BRANCH_ADMIN, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ branchId: 1 }));
  });

  it('rejects a non-numeric branchId', async () => {
    const res = mockRes();
    await systemConfigController.list(
      { query: { branchId: 'abc' }, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('systemConfig.controller — getByKey', () => {
  it('404s for an unknown key', async () => {
    const res = mockRes();
    await systemConfigController.getByKey(
      { params: { key: 'NOT_A_KEY' }, query: {}, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the resolved setting', async () => {
    const res = mockRes();
    await systemConfigController.getByKey(
      { params: { key: 'BOOKING_HOLD_TIME' }, query: {}, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ key: 'BOOKING_HOLD_TIME', value: 5, source: 'DEFAULT' }));
  });
});

describe('systemConfig.controller — update', () => {
  it('404s for an unknown key', async () => {
    const res = mockRes();
    await systemConfigController.update(
      { params: { key: 'NOT_A_KEY' }, body: { value: 1 }, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400s when value is missing', async () => {
    const res = mockRes();
    await systemConfigController.update(
      { params: { key: 'BOOKING_HOLD_TIME' }, body: {}, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('a super admin can set the Global Setting and it is audited', async () => {
    const res = mockRes();
    await systemConfigController.update(
      {
        params: { key: 'BOOKING_HOLD_TIME' },
        body: { value: 10 },
        account: SUPER_ADMIN,
        permissionScope: 'ALL',
      },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ value: 10, source: 'GLOBAL' }));

    const logs = await AuditLog.find({ action: AuditLog.ACTION.UPDATE_SYSTEM_CONFIG });
    expect(logs).toHaveLength(1);
    expect(logs[0].performed_by).toBe(1);
    expect(logs[0].branch_id).toBeNull();
    expect(logs[0].metadata).toMatchObject({ key: 'BOOKING_HOLD_TIME', value: 10 });
  });

  it('a branch admin cannot set the Global Setting', async () => {
    const res = mockRes();
    await systemConfigController.update(
      {
        params: { key: 'BOOKING_HOLD_TIME' },
        body: { value: 10 },
        account: BRANCH_ADMIN,
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("a branch admin cannot set another branch's setting", async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = mockRes();
    await systemConfigController.update(
      {
        params: { key: 'BOOKING_HOLD_TIME' },
        body: { value: 10, branchId: 1 },
        account: BRANCH_ADMIN,
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('a branch admin can set an override for its own branch (only for a branch-overridable key)', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await systemConfigController.update(
      {
        params: { key: 'BOOKING_HOLD_TIME' },
        body: { value: 8, branchId: 1 },
        account: BRANCH_ADMIN,
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ value: 8, source: 'BRANCH', branchId: 1 }));
  });

  it('a branch admin is rejected when overriding a non-branch-overridable key', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await systemConfigController.update(
      {
        params: { key: 'TAX_RATE' },
        body: { value: 8, branchId: 1 },
        account: BRANCH_ADMIN,
        permissionScope: 'BRANCH',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SETTING_INVALID' }));
  });

  it('400s with details for an out-of-range value', async () => {
    const res = mockRes();
    await systemConfigController.update(
      {
        params: { key: 'BOOKING_HOLD_TIME' },
        body: { value: 999 },
        account: SUPER_ADMIN,
        permissionScope: 'ALL',
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SETTING_INVALID' }));
  });
});

describe('systemConfig.controller — reset', () => {
  it('resets an override back to the parent level and audits it', async () => {
    await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', value: 10, accountId: 1 });
    const res = mockRes();
    await systemConfigController.reset(
      { params: { key: 'BOOKING_HOLD_TIME' }, query: {}, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ value: 5, source: 'DEFAULT' }));

    const logs = await AuditLog.find({ action: AuditLog.ACTION.RESET_SYSTEM_CONFIG });
    expect(logs).toHaveLength(1);
  });

  it('404s for an unknown key', async () => {
    const res = mockRes();
    await systemConfigController.reset(
      { params: { key: 'NOT_A_KEY' }, query: {}, account: SUPER_ADMIN, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('a branch admin cannot reset the Global Setting', async () => {
    const res = mockRes();
    await systemConfigController.reset(
      { params: { key: 'BOOKING_HOLD_TIME' }, query: {}, account: BRANCH_ADMIN, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
