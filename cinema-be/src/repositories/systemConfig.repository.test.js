const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const systemConfigRepository = require('./systemConfig.repository');
const SystemConfig = require('../models/SystemConfig');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('systemConfig.repository', () => {
  describe('upsert', () => {
    it('creates a new row when none exists', async () => {
      const doc = await systemConfigRepository.upsert({
        key: 'BOOKING_HOLD_TIME',
        branchId: null,
        value: 10,
        accountId: 1,
      });
      expect(doc.id).toBeGreaterThan(0);
      expect(doc.value).toBe(10);
      expect(doc.updated_by).toBe(1);
    });

    it('updates the existing row in place instead of creating a duplicate', async () => {
      const first = await systemConfigRepository.upsert({ key: 'BOOKING_HOLD_TIME', branchId: null, value: 10 });
      const second = await systemConfigRepository.upsert({
        key: 'BOOKING_HOLD_TIME',
        branchId: null,
        value: 15,
        accountId: 2,
      });
      expect(second.id).toBe(first.id);
      expect(second.value).toBe(15);
      expect(second.updated_by).toBe(2);
      expect(await SystemConfig.countDocuments({ key: 'BOOKING_HOLD_TIME', branch_id: null })).toBe(1);
    });

    it('keeps the global row and a branch row independent', async () => {
      await systemConfigRepository.upsert({ key: 'BOOKING_HOLD_TIME', branchId: null, value: 5 });
      await systemConfigRepository.upsert({ key: 'BOOKING_HOLD_TIME', branchId: 7, value: 9 });
      expect(await SystemConfig.countDocuments({ key: 'BOOKING_HOLD_TIME' })).toBe(2);
    });
  });

  describe('findOne', () => {
    it('finds by key + branch, treating undefined branchId as global', async () => {
      await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
      expect((await systemConfigRepository.findOne('BOOKING_HOLD_TIME')).value).toBe(5);
      expect(await systemConfigRepository.findOne('BOOKING_HOLD_TIME', 7)).toBeNull();
    });
  });

  describe('findForResolution', () => {
    it('returns both the global row and the branch row for that branch', async () => {
      await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
      await SystemConfig.create({ id: 2, key: 'BOOKING_HOLD_TIME', branch_id: 7, value: 9 });
      await SystemConfig.create({ id: 3, key: 'BOOKING_HOLD_TIME', branch_id: 8, value: 1 });

      const rows = await systemConfigRepository.findForResolution('BOOKING_HOLD_TIME', 7);
      expect(rows.map((r) => r.branch_id).sort()).toEqual([null, 7].sort());
    });

    it('returns only the global row when branchId is null', async () => {
      await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
      await SystemConfig.create({ id: 2, key: 'BOOKING_HOLD_TIME', branch_id: 7, value: 9 });
      const rows = await systemConfigRepository.findForResolution('BOOKING_HOLD_TIME', null);
      expect(rows).toHaveLength(1);
      expect(rows[0].branch_id).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the row for that key + branch and returns it', async () => {
      await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
      const removed = await systemConfigRepository.remove('BOOKING_HOLD_TIME', null);
      expect(removed.value).toBe(5);
      expect(await SystemConfig.countDocuments()).toBe(0);
    });

    it('returns null when nothing to delete', async () => {
      expect(await systemConfigRepository.remove('BOOKING_HOLD_TIME', null)).toBeNull();
    });
  });

  describe('findAllForBranch', () => {
    it('returns global rows plus that branch\'s rows only', async () => {
      await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 5 });
      await SystemConfig.create({ id: 2, key: 'CANCELLATION_LIMIT', branch_id: 7, value: 3 });
      await SystemConfig.create({ id: 3, key: 'CANCELLATION_LIMIT', branch_id: 8, value: 1 });

      const rows = await systemConfigRepository.findAllForBranch(7);
      expect(rows).toHaveLength(2);
      expect(rows.some((r) => r.branch_id === 8)).toBe(false);
    });
  });
});
