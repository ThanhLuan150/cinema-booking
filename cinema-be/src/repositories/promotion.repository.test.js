const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const promotionRepository = require('./promotion.repository');
const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    name: 'Promo',
    discount_type: 'FIXED_AMOUNT',
    discount_value: 1000,
    start_at: new Date('2026-01-01'),
    end_at: new Date('2026-02-01'),
    ...overrides,
  };
}

describe('promotion.repository', () => {
  it('findOwnedCinemaIds returns branch ids owned by the account', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    expect(await promotionRepository.findOwnedCinemaIds(42)).toEqual([1]);
  });

  it('findFiltered paginates on an arbitrary filter', async () => {
    await Promotion.create([
      baseFields({ id: 1, code: 'A' }),
      baseFields({ id: 2, code: 'B', branch_ids: [1] }),
    ]);
    const result = await promotionRepository.findFiltered({ branch_ids: 1 });
    expect(result.total).toBe(1);
    expect(result.data[0].code).toBe('B');
  });

  it('findByCode is case-insensitive and returns any status', async () => {
    await Promotion.create([
      baseFields({ id: 1, code: 'SAVE10' }),
      baseFields({ id: 2, code: 'OLD', status: 'INACTIVE' }),
    ]);
    expect(await promotionRepository.findByCode('save10')).not.toBeNull();
    expect(await promotionRepository.findByCode('OLD')).not.toBeNull();
    expect(await promotionRepository.findByCode('NOPE')).toBeNull();
  });

  it('findById finds a promotion by numeric id', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'A' }));
    expect((await promotionRepository.findById('1')).code).toBe('A');
  });

  it('create/updateFields/remove manage a promotion document', async () => {
    const created = await promotionRepository.create(baseFields({ id: 1, code: 'A' }));
    expect(created.id).toBe(1);

    const updated = await promotionRepository.updateFields(1, { status: 'INACTIVE' });
    expect(updated.status).toBe('INACTIVE');

    await promotionRepository.remove(1);
    expect(await Promotion.countDocuments()).toBe(0);
  });

  it('remove also deletes the promotion\'s usage records', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'A' }));
    await PromotionUsage.create({ promotion_id: 1, account_id: 7, count: 2 });
    await promotionRepository.remove(1);
    expect(await PromotionUsage.countDocuments({ promotion_id: 1 })).toBe(0);
  });

  describe('findUsage / recordUsage', () => {
    it('findUsage returns null when the customer has never used the promotion', async () => {
      await Promotion.create(baseFields({ id: 1, code: 'A' }));
      expect(await promotionRepository.findUsage(1, 7)).toBeNull();
    });

    it('recordUsage creates a usage row and bumps both counters on first use', async () => {
      await Promotion.create(baseFields({ id: 1, code: 'A' }));
      await promotionRepository.recordUsage(1, 7);

      const promotion = await Promotion.findOne({ id: 1 });
      expect(promotion.used_count).toBe(1);

      const usage = await promotionRepository.findUsage(1, 7);
      expect(usage.count).toBe(1);
    });

    it('recordUsage increments existing counters on repeat use by the same customer', async () => {
      await Promotion.create(baseFields({ id: 1, code: 'A' }));
      await promotionRepository.recordUsage(1, 7);
      await promotionRepository.recordUsage(1, 7);

      const promotion = await Promotion.findOne({ id: 1 });
      expect(promotion.used_count).toBe(2);

      const usage = await promotionRepository.findUsage(1, 7);
      expect(usage.count).toBe(2);
    });

    it('tracks separate customers independently', async () => {
      await Promotion.create(baseFields({ id: 1, code: 'A' }));
      await promotionRepository.recordUsage(1, 7);
      await promotionRepository.recordUsage(1, 8);

      expect((await promotionRepository.findUsage(1, 7)).count).toBe(1);
      expect((await promotionRepository.findUsage(1, 8)).count).toBe(1);
      expect((await Promotion.findOne({ id: 1 })).used_count).toBe(2);
    });
  });
});
