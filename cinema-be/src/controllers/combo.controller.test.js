const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const comboController = require('./combo.controller');
const Combo = require('../models/Combo');
const Branch = require('../models/Branch');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('combo.controller list', () => {
  it('scopes to branchId query when provided, active combos only', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'Active', price: 1, active: true },
      { id: 2, cinema_id: 1, name: 'Inactive', price: 1, active: false },
    ]);
    const res = mockRes();
    await comboController.list({ query: { branchId: '1' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('scopes an owner (role 2) to combos across their own cinemas', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Combo.create({ id: 1, cinema_id: 1, name: 'Combo', price: 1 });
    const res = mockRes();
    await comboController.list({ query: {}, account: { role: 2, accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('returns all combos for admin (role 0)', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'A', price: 1, active: true },
      { id: 2, cinema_id: 2, name: 'B', price: 1, active: false },
    ]);
    const res = mockRes();
    await comboController.list({ query: {}, account: { role: 0 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('defaults to only active combos for an unauthenticated/user request', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'A', price: 1, active: true },
      { id: 2, cinema_id: 1, name: 'B', price: 1, active: false },
    ]);
    const res = mockRes();
    await comboController.list({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});

describe('combo.controller getById', () => {
  it('returns 404 for an unknown combo', async () => {
    const res = mockRes();
    await comboController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('combo.controller create', () => {
  it('rejects missing name or price', async () => {
    const res = mockRes();
    await comboController.create({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a combo with normalized numeric fields', async () => {
    const res = mockRes();
    await comboController.create({ body: { cinema_id: '1', name: 'Popcorn', price: '50000' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Combo.findOne({ name: 'Popcorn' });
    expect(created.price).toBe(50000);
    expect(created.cinema_id).toBe(1);
  });
});

describe('combo.controller update/remove', () => {
  it('update returns 404 for an unknown combo', async () => {
    const res = mockRes();
    await comboController.update({ params: { id: 999 }, body: { name: 'X' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('update only applies whitelisted fields', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'Old', price: 1 });
    const res = mockRes();
    await comboController.update({ params: { id: 1 }, body: { name: 'New', cinema_id: 999 } }, res);
    const updated = await Combo.findOne({ id: 1 });
    expect(updated.name).toBe('New');
    expect(updated.cinema_id).toBe(1);
  });

  it('remove deletes the combo', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'A', price: 1 });
    const res = mockRes();
    await comboController.remove({ params: { id: 1 } }, res);
    expect(await Combo.countDocuments()).toBe(0);
  });
});
