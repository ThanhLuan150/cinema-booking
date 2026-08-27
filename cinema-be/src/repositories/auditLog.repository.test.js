const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const auditLogRepository = require('./auditLog.repository');
const AuditLog = require('../models/AuditLog');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('auditLog.repository', () => {
  describe('create', () => {
    it('appends a row with an auto-incremented id and the given actor/branch scope', async () => {
      const a = await auditLogRepository.create({
        entityType: 'MOVIE',
        entityId: 3,
        action: 'CREATE_MOVIE',
        performedBy: 9,
        metadata: { name: 'Dune' },
      });
      const b = await auditLogRepository.create({
        entityType: 'BRANCH',
        entityId: 5,
        action: 'UPDATE_BRANCH',
        performedBy: 9,
        branchId: 5,
      });
      expect(b.id).toBe(a.id + 1);
      expect(a.branch_id).toBeNull();
      expect(b.branch_id).toBe(5);
    });
  });

  describe('findFiltered', () => {
    beforeEach(async () => {
      const rows = [
        { entityType: 'BRANCH', entityId: 1, action: 'CREATE_BRANCH', performedBy: 1, branchId: 1 },
        { entityType: 'EMPLOYEE', entityId: 2, action: 'CREATE_EMPLOYEE', performedBy: 1, branchId: 1 },
        { entityType: 'BOOKING', entityId: 3, action: 'CREATE_BOOKING', performedBy: 2, branchId: 2 },
        { entityType: 'MOVIE', entityId: 4, action: 'CREATE_MOVIE', performedBy: 1, branchId: null },
      ];
      for (const r of rows) await auditLogRepository.create(r);
    });

    it('returns newest first with a total count', async () => {
      const { data, total } = await auditLogRepository.findFiltered({}, { skip: 0, limit: 10 });
      expect(total).toBe(4);
      expect(data[0].id).toBeGreaterThan(data[data.length - 1].id);
    });

    it('scopes to a set of branch ids (branchIds), excluding system-wide rows', async () => {
      const { data, total } = await auditLogRepository.findFiltered({ branchIds: [1] }, {});
      expect(total).toBe(2);
      expect(data.every((r) => r.branch_id === 1)).toBe(true);
    });

    it('filters by a single branchId', async () => {
      const { total } = await auditLogRepository.findFiltered({ branchId: 2 }, {});
      expect(total).toBe(1);
    });

    it('filters by entityType, action and performedBy', async () => {
      expect((await auditLogRepository.findFiltered({ entityType: 'BRANCH' }, {})).total).toBe(1);
      expect((await auditLogRepository.findFiltered({ action: 'CREATE_MOVIE' }, {})).total).toBe(1);
      expect((await auditLogRepository.findFiltered({ performedBy: 1 }, {})).total).toBe(3);
    });

    it('paginates', async () => {
      const page1 = await auditLogRepository.findFiltered({}, { skip: 0, limit: 2 });
      const page2 = await auditLogRepository.findFiltered({}, { skip: 2, limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      expect(page1.data.map((r) => r.id)).not.toEqual(expect.arrayContaining(page2.data.map((r) => r.id)));
    });

    it('filters by a createdAt window', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      expect((await auditLogRepository.findFiltered({ from: future }, {})).total).toBe(0);
      expect((await auditLogRepository.findFiltered({ to: future }, {})).total).toBe(4);
    });
  });

  describe('findById', () => {
    it('returns a single row or null', async () => {
      const row = await auditLogRepository.create({ entityType: 'MOVIE', entityId: 1, action: 'CREATE_MOVIE' });
      expect((await auditLogRepository.findById(row.id)).id).toBe(row.id);
      expect(await auditLogRepository.findById(9999)).toBeNull();
    });
  });
});
