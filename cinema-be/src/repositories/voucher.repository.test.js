const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const voucherRepository = require('./voucher.repository');
const Voucher = require('../models/Voucher');
const VoucherUsage = require('../models/VoucherUsage');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('voucher.repository', () => {
  it('findOwnedCinemaIds returns branch ids owned by the account', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    expect(await voucherRepository.findOwnedCinemaIds(42)).toEqual([1]);
  });

  it('findFiltered paginates on an arbitrary filter', async () => {
    await Voucher.create([
      { id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 },
      { id: 2, code: 'B', discount_type: 'FIXED_AMOUNT', discount_value: 2000, cinema_id: 1 },
    ]);
    const result = await voucherRepository.findFiltered({ cinema_id: 1 });
    expect(result.total).toBe(1);
    expect(result.data[0].code).toBe('B');
  });

  it('findByCode is case-insensitive and only returns active vouchers', async () => {
    await Voucher.create([
      { id: 1, code: 'SAVE10', discount_type: 'FIXED_AMOUNT', discount_value: 1000, active: true },
      { id: 2, code: 'OLD', discount_type: 'FIXED_AMOUNT', discount_value: 1000, active: false },
    ]);
    expect(await voucherRepository.findByCode('save10')).not.toBeNull();
    expect(await voucherRepository.findByCode('OLD')).toBeNull();
  });

  it('findById finds a voucher by numeric id', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    expect((await voucherRepository.findById('1')).code).toBe('A');
  });

  it('findCinemaById finds the branch by id', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    expect((await voucherRepository.findCinemaById(1)).name).toBe('A');
  });

  it('create/updateFields/remove manage a voucher document', async () => {
    const created = await voucherRepository.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    expect(created.id).toBe(1);

    const updated = await voucherRepository.updateFields(1, { active: false });
    expect(updated.active).toBe(false);

    await voucherRepository.remove(1);
    expect(await Voucher.countDocuments()).toBe(0);
  });

  it('remove also deletes the voucher\'s usage history', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 });
    await VoucherUsage.create({ id: 1, voucher_id: 1, account_id: 42 });
    await voucherRepository.remove(1);
    expect(await VoucherUsage.countDocuments()).toBe(0);
  });

  describe('recordUsage', () => {
    it('increments used_count and writes a usage-history row', async () => {
      await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000, used_count: 0 });
      const result = await voucherRepository.recordUsage({ voucherId: 1, accountId: 42, bookingId: 7, discountAmount: 1000 });
      expect(result.used_count).toBe(1);
      const usage = await VoucherUsage.findOne({ voucher_id: 1 });
      expect(usage.account_id).toBe(42);
      expect(usage.booking_id).toBe(7);
      expect(usage.discount_amount).toBe(1000);
    });

    it('refuses to record usage once max_uses is reached, and never over-counts', async () => {
      await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000, max_uses: 1, used_count: 1 });
      const result = await voucherRepository.recordUsage({ voucherId: 1, accountId: 42 });
      expect(result).toBeNull();
      expect((await Voucher.findOne({ id: 1 })).used_count).toBe(1);
      expect(await VoucherUsage.countDocuments()).toBe(0);
    });

    it('never lets concurrent usage push used_count past max_uses (atomic, race-safe)', async () => {
      await Voucher.create({ id: 1, code: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000, max_uses: 1, used_count: 0 });

      const [a, b] = await Promise.all([
        voucherRepository.recordUsage({ voucherId: 1, accountId: 10 }),
        voucherRepository.recordUsage({ voucherId: 1, accountId: 20 }),
      ]);

      const succeeded = [a, b].filter(Boolean);
      expect(succeeded).toHaveLength(1);
      expect((await Voucher.findOne({ id: 1 })).used_count).toBe(1);
      expect(await VoucherUsage.countDocuments()).toBe(1);
    });
  });

  describe('findUsageHistory', () => {
    it('paginates newest-first', async () => {
      await VoucherUsage.create([
        { id: 1, voucher_id: 1, account_id: 10 },
        { id: 2, voucher_id: 1, account_id: 20 },
        { id: 3, voucher_id: 2, account_id: 30 },
      ]);
      const result = await voucherRepository.findUsageHistory(1);
      expect(result.total).toBe(2);
      expect(result.data[0].id).toBe(2);
    });
  });
});
