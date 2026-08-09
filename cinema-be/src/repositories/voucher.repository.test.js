const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const voucherRepository = require('./voucher.repository');
const Voucher = require('../models/Voucher');
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
      { id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000 },
      { id: 2, code: 'B', discount_type: 'fixed', discount_value: 2000, cinema_id: 1 },
    ]);
    const result = await voucherRepository.findFiltered({ cinema_id: 1 });
    expect(result.total).toBe(1);
    expect(result.data[0].code).toBe('B');
  });

  it('findByCode is case-insensitive and only returns active vouchers', async () => {
    await Voucher.create([
      { id: 1, code: 'SAVE10', discount_type: 'fixed', discount_value: 1000, active: true },
      { id: 2, code: 'OLD', discount_type: 'fixed', discount_value: 1000, active: false },
    ]);
    expect(await voucherRepository.findByCode('save10')).not.toBeNull();
    expect(await voucherRepository.findByCode('OLD')).toBeNull();
  });

  it('findById finds a voucher by numeric id', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000 });
    expect((await voucherRepository.findById('1')).code).toBe('A');
  });

  it('findCinemaById finds the branch by id', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    expect((await voucherRepository.findCinemaById(1)).name).toBe('A');
  });

  it('create/updateFields/remove manage a voucher document', async () => {
    const created = await voucherRepository.create({ id: 1, code: 'A', discount_type: 'fixed', discount_value: 1000 });
    expect(created.id).toBe(1);

    const updated = await voucherRepository.updateFields(1, { active: false });
    expect(updated.active).toBe(false);

    await voucherRepository.remove(1);
    expect(await Voucher.countDocuments()).toBe(0);
  });
});
