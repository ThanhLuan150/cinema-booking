const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { recordAudit, ACTION, ENTITY_TYPE } = require('./auditLog.service');
const auditLogRepository = require('../repositories/auditLog.repository');
const AuditLog = require('../models/AuditLog');

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});
afterAll(async () => closeDatabase());

describe('auditLog.service.recordAudit', () => {
  it('resolves the actor from req.account and appends a row', async () => {
    await recordAudit({
      req: { account: { accountId: 55 } },
      action: ACTION.CREATE_BRANCH,
      entityType: ENTITY_TYPE.BRANCH,
      entityId: 1,
      branchId: 1,
    });
    const [row] = await AuditLog.find();
    expect(row.performed_by).toBe(55);
    expect(row.action).toBe('CREATE_BRANCH');
  });

  it('honours an explicit performedBy (e.g. null for a gateway callback)', async () => {
    await recordAudit({
      performedBy: null,
      action: ACTION.PAYMENT_SUCCESS,
      entityType: ENTITY_TYPE.PAYMENT,
      entityId: 2,
      branchId: 3,
    });
    const [row] = await AuditLog.find();
    expect(row.performed_by).toBeNull();
    expect(row.branch_id).toBe(3);
  });

  it('never throws when the write fails — the business op must not break', async () => {
    jest.spyOn(auditLogRepository, 'create').mockRejectedValue(new Error('db down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      recordAudit({ action: ACTION.CREATE_MOVIE, entityType: ENTITY_TYPE.MOVIE, entityId: 9 }),
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
