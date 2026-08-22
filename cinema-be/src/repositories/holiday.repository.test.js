const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const holidayRepository = require('./holiday.repository');
const Holiday = require('../models/Holiday');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('holiday.repository', () => {
  it('findFiltered sorts by date desc, and paginates', async () => {
    await Holiday.create([
      { id: 1, date: '2026-01-01' },
      { id: 2, date: '2026-12-25' },
    ]);
    const result = await holidayRepository.findFiltered({});
    expect(result.total).toBe(2);
    expect(result.data.map((h) => h.id)).toEqual([2, 1]);
  });

  it('findFiltered applies the given filter', async () => {
    await Holiday.create([
      { id: 1, date: '2026-01-01', branch_id: 1 },
      { id: 2, date: '2026-01-01', branch_id: 2 },
    ]);
    const result = await holidayRepository.findFiltered({ branch_id: 1 });
    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe(1);
  });

  it('findById returns the matching holiday', async () => {
    await Holiday.create({ id: 1, date: '2026-01-01' });
    expect((await holidayRepository.findById(1)).date).toBe('2026-01-01');
  });

  it('findOwnedCinemaIds returns branch ids owned by the account', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    expect(await holidayRepository.findOwnedCinemaIds(42)).toEqual([1]);
  });

  it('create/updateFields/remove manage a holiday document', async () => {
    const created = await holidayRepository.create({ id: 1, date: '2026-01-01', name: "New Year's" });
    expect(created.id).toBe(1);

    const updated = await holidayRepository.updateFields(1, { name: 'Updated' });
    expect(updated.name).toBe('Updated');

    await holidayRepository.remove(1);
    expect(await Holiday.countDocuments()).toBe(0);
  });
});
