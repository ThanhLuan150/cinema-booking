const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const systemConfigService = require('./systemConfig.service');
const systemConfigRepository = require('../repositories/systemConfig.repository');
const SystemConfig = require('../models/SystemConfig');

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  systemConfigService.invalidateAll();
});
afterAll(async () => closeDatabase());

describe('systemConfig.service', () => {
  describe('getEffective / getValue — resolution order', () => {
    it('falls back to the registry default when nothing is overridden', async () => {
      const effective = await systemConfigService.getEffective('BOOKING_HOLD_TIME');
      expect(effective.value).toBe(5);
      expect(effective.source).toBe('DEFAULT');
      expect(effective.id).toBeNull();
    });

    it('uses the global override when present', async () => {
      await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 15 });
      const effective = await systemConfigService.getEffective('BOOKING_HOLD_TIME');
      expect(effective.value).toBe(15);
      expect(effective.source).toBe('GLOBAL');
    });

    it('prefers a branch override over the global override', async () => {
      await SystemConfig.create({ id: 1, key: 'BOOKING_HOLD_TIME', branch_id: null, value: 15 });
      await SystemConfig.create({ id: 2, key: 'BOOKING_HOLD_TIME', branch_id: 7, value: 20 });
      const effective = await systemConfigService.getEffective('BOOKING_HOLD_TIME', 7);
      expect(effective.value).toBe(20);
      expect(effective.source).toBe('BRANCH');

      // A different branch with no override of its own still sees the global value.
      const other = await systemConfigService.getEffective('BOOKING_HOLD_TIME', 8);
      expect(other.value).toBe(15);
      expect(other.source).toBe('GLOBAL');
    });

    it('ignores a branch-level row for a non-branch-overridable setting', async () => {
      // Simulates stale/manually-inserted data — even if a branch row exists, a setting marked
      // branchOverridable: false must never resolve to it.
      await SystemConfig.create({ id: 1, key: 'TAX_RATE', branch_id: 7, value: 20 });
      const effective = await systemConfigService.getEffective('TAX_RATE', 7);
      expect(effective.source).toBe('DEFAULT');
      expect(effective.value).toBe(0);
    });

    it('getValue returns just the resolved value', async () => {
      await SystemConfig.create({ id: 1, key: 'MAX_BOOKING_SEATS', branch_id: null, value: 4 });
      expect(await systemConfigService.getValue('MAX_BOOKING_SEATS')).toBe(4);
    });

    it('throws for an unknown key', async () => {
      await expect(systemConfigService.getEffective('NOT_A_KEY')).rejects.toThrow(
        systemConfigService.SettingValidationError,
      );
    });
  });

  describe('getAllEffective', () => {
    it('returns every registered setting', async () => {
      const all = await systemConfigService.getAllEffective();
      expect(all.map((s) => s.key).sort()).toEqual(
        [
          'BOOKING_HOLD_TIME',
          'CHECKIN_BEFORE_SHOWTIME',
          'CANCELLATION_LIMIT',
          'DEFAULT_CURRENCY',
          'TAX_RATE',
          'MAX_BOOKING_SEATS',
          'REFUND_POLICY',
        ].sort(),
      );
    });
  });

  describe('setValue', () => {
    it('creates a global override and it is immediately visible (cache invalidation)', async () => {
      await systemConfigService.getEffective('BOOKING_HOLD_TIME'); // warm the DEFAULT into cache
      const result = await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', value: 12, accountId: 1 });
      expect(result.value).toBe(12);
      expect(result.source).toBe('GLOBAL');

      const reread = await systemConfigService.getEffective('BOOKING_HOLD_TIME');
      expect(reread.value).toBe(12);
    });

    it('creates a branch override without disturbing the global value', async () => {
      await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', value: 12, accountId: 1 });
      await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', branchId: 7, value: 20, accountId: 2 });

      expect((await systemConfigService.getEffective('BOOKING_HOLD_TIME')).value).toBe(12);
      expect((await systemConfigService.getEffective('BOOKING_HOLD_TIME', 7)).value).toBe(20);
    });

    it('rejects a branch override for a non-branch-overridable setting', async () => {
      await expect(
        systemConfigService.setValue({ key: 'TAX_RATE', branchId: 7, value: 5, accountId: 1 }),
      ).rejects.toMatchObject({
        details: [expect.objectContaining({ code: 'NOT_BRANCH_OVERRIDABLE' })],
      });
      expect(await systemConfigRepository.findOne('TAX_RATE', 7)).toBeNull();
    });

    it('rejects an out-of-range value and does not persist it', async () => {
      await expect(
        systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', value: 999, accountId: 1 }),
      ).rejects.toThrow(systemConfigService.SettingValidationError);
      expect(await systemConfigRepository.findOne('BOOKING_HOLD_TIME', null)).toBeNull();
    });

    it('stores the JSON REFUND_POLICY tiers as-is', async () => {
      const tiers = [
        { minHours: 48, percent: 100 },
        { minHours: 4, percent: 60 },
      ];
      const result = await systemConfigService.setValue({ key: 'REFUND_POLICY', value: tiers, accountId: 1 });
      expect(result.value).toEqual(tiers);
    });
  });

  describe('resetValue', () => {
    it('removes a branch override so it falls back to the global value', async () => {
      await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', value: 12, accountId: 1 });
      await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', branchId: 7, value: 20, accountId: 2 });

      const reset = await systemConfigService.resetValue({ key: 'BOOKING_HOLD_TIME', branchId: 7 });
      expect(reset.value).toBe(12);
      expect(reset.source).toBe('GLOBAL');
    });

    it('removes the global override so it falls back to the registry default', async () => {
      await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', value: 12, accountId: 1 });
      const reset = await systemConfigService.resetValue({ key: 'BOOKING_HOLD_TIME' });
      expect(reset.value).toBe(5);
      expect(reset.source).toBe('DEFAULT');
    });

    it('is a no-op when there is nothing to reset', async () => {
      const reset = await systemConfigService.resetValue({ key: 'BOOKING_HOLD_TIME' });
      expect(reset.source).toBe('DEFAULT');
    });
  });

  describe('caching', () => {
    it('serves a repeated read from cache without hitting the repository again', async () => {
      await systemConfigService.setValue({ key: 'BOOKING_HOLD_TIME', value: 12, accountId: 1 });
      const spy = jest.spyOn(systemConfigRepository, 'findForResolution');
      await systemConfigService.getEffective('BOOKING_HOLD_TIME');
      await systemConfigService.getEffective('BOOKING_HOLD_TIME');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
