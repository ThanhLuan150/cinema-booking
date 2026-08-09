const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const comboRepository = require('./combo.repository');
const Combo = require('../models/Combo');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('combo.repository', () => {
  it('findCinemaIdByComboId returns the owning branch id', async () => {
    await Combo.create({ id: 1, cinema_id: 5, name: 'Combo A', price: 50000 });
    expect(await comboRepository.findCinemaIdByComboId(1)).toBe(5);
  });

  it('findCinemaIdByComboId returns null for an unknown combo', async () => {
    expect(await comboRepository.findCinemaIdByComboId(999)).toBeNull();
  });

  it('findActiveByCinemaId only returns active combos for that branch', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'Active', price: 1, active: true },
      { id: 2, cinema_id: 1, name: 'Inactive', price: 1, active: false },
      { id: 3, cinema_id: 2, name: 'Other branch', price: 1, active: true },
    ]);
    const result = await comboRepository.findActiveByCinemaId(1);
    expect(result.total).toBe(1);
    expect(result.data[0].name).toBe('Active');
  });

  it('findByCinemaIds returns combos across multiple branches', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'A', price: 1 },
      { id: 2, cinema_id: 2, name: 'B', price: 1 },
      { id: 3, cinema_id: 3, name: 'C', price: 1 },
    ]);
    const result = await comboRepository.findByCinemaIds([1, 2]);
    expect(result.total).toBe(2);
  });

  it('findAll returns every combo regardless of status', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'A', price: 1, active: true },
      { id: 2, cinema_id: 1, name: 'B', price: 1, active: false },
    ]);
    const result = await comboRepository.findAll();
    expect(result.total).toBe(2);
  });

  it('findActive returns only active combos across all branches', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'A', price: 1, active: true },
      { id: 2, cinema_id: 1, name: 'B', price: 1, active: false },
    ]);
    const result = await comboRepository.findActive();
    expect(result.total).toBe(1);
  });

  it('findById returns the matching combo', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'A', price: 1 });
    expect((await comboRepository.findById(1)).name).toBe('A');
  });

  it('findOwnedCinemaIds returns branch ids owned by the account', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    expect(await comboRepository.findOwnedCinemaIds(42)).toEqual([1]);
  });

  it('create/updateFields/remove manage a combo document', async () => {
    const created = await comboRepository.create({ id: 1, cinema_id: 1, name: 'A', price: 1 });
    expect(created.id).toBe(1);

    const updated = await comboRepository.updateFields(1, { name: 'Updated' });
    expect(updated.name).toBe('Updated');

    await comboRepository.remove(1);
    expect(await Combo.countDocuments()).toBe(0);
  });
});
