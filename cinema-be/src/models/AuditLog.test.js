const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const AuditLog = require('./AuditLog');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedLog(overrides = {}) {
  return AuditLog.create({
    id: 1,
    entity_type: 'BRANCH',
    entity_id: 7,
    action: 'CREATE_BRANCH',
    performed_by: 42,
    branch_id: 7,
    metadata: { name: 'Branch A' },
    ...overrides,
  });
}

describe('AuditLog model', () => {
  it('persists an append row with an actor, branch scope and timestamp', async () => {
    const log = await seedLog();
    expect(log.performed_by).toBe(42);
    expect(log.branch_id).toBe(7);
    expect(log.createdAt).toBeInstanceOf(Date);
  });

  it('exposes the actor as user_id (spec alias) as well as performed_by in JSON', async () => {
    const log = await seedLog({ performed_by: 42 });
    expect(log.toJSON().user_id).toBe(42);
    const sys = await seedLog({ id: 2, performed_by: null });
    expect(sys.toJSON().user_id).toBeNull();
  });

  it('rejects an unknown action (enum-guarded vocabulary)', async () => {
    await expect(seedLog({ action: 'DROP_DATABASE' })).rejects.toThrow();
  });

  it('rejects an unknown entity_type', async () => {
    await expect(seedLog({ entity_type: 'SECRETS' })).rejects.toThrow();
  });

  describe('immutability', () => {
    it('refuses an in-place document save() after creation', async () => {
      const log = await seedLog();
      log.reason = 'tampered';
      await expect(log.save()).rejects.toThrow(AuditLog.IMMUTABLE_MESSAGE);
    });

    it('refuses findOneAndUpdate', async () => {
      await seedLog();
      await expect(AuditLog.findOneAndUpdate({ id: 1 }, { reason: 'x' })).rejects.toThrow(AuditLog.IMMUTABLE_MESSAGE);
      expect((await AuditLog.findOne({ id: 1 })).reason).toBeNull();
    });

    it('refuses updateOne / updateMany', async () => {
      await seedLog();
      await expect(AuditLog.updateOne({ id: 1 }, { reason: 'x' })).rejects.toThrow(AuditLog.IMMUTABLE_MESSAGE);
      await expect(AuditLog.updateMany({}, { reason: 'x' })).rejects.toThrow(AuditLog.IMMUTABLE_MESSAGE);
    });

    it('refuses deleteOne / deleteMany / findOneAndDelete', async () => {
      await seedLog();
      await expect(AuditLog.deleteOne({ id: 1 })).rejects.toThrow(AuditLog.IMMUTABLE_MESSAGE);
      await expect(AuditLog.deleteMany({})).rejects.toThrow(AuditLog.IMMUTABLE_MESSAGE);
      await expect(AuditLog.findOneAndDelete({ id: 1 })).rejects.toThrow(AuditLog.IMMUTABLE_MESSAGE);
      expect(await AuditLog.countDocuments()).toBe(1);
    });
  });
});
