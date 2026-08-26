const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const inventoryController = require('./inventory.controller');
const inventoryRepository = require('../repositories/inventory.repository');
const Inventory = require('../models/Inventory');
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

describe('inventory.controller list', () => {
  it('ALL scope (Super Admin) sees every branch, optionally filtered by branchId', async () => {
    await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 10, minimumQuantity: 5, unit: 'pcs' });
    await inventoryRepository.create({ branchId: 2, item: 'Coke', quantity: 10, minimumQuantity: 5, unit: 'pcs' });

    const res = mockRes();
    await inventoryController.list({ query: {}, permissionScope: 'ALL', account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('BRANCH scope (Branch Admin) is limited to their own owned branches', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 10, minimumQuantity: 5, unit: 'pcs' });
    await inventoryRepository.create({ branchId: 2, item: 'Coke', quantity: 10, minimumQuantity: 5, unit: 'pcs' });

    const res = mockRes();
    await inventoryController.list({ query: {}, permissionScope: 'BRANCH', account: { accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('BRANCH scope requesting another branch via branchId is forbidden', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await inventoryController.list(
      { query: { branchId: '2' }, permissionScope: 'BRANCH', account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('inventory.controller create', () => {
  it('rejects missing item/unit', async () => {
    const res = mockRes();
    await inventoryController.create({ body: {}, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects negative quantity/minimum_quantity', async () => {
    const res = mockRes();
    await inventoryController.create({ body: { item: 'Popcorn', unit: 'pcs', quantity: -1 }, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates an item scoped to req.branchId (set by requireBranchOwnership upstream)', async () => {
    const res = mockRes();
    await inventoryController.create(
      { body: { item: 'Popcorn', unit: 'pcs', quantity: '10', minimum_quantity: '5' }, branchId: 1 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Inventory.findOne({ item: 'Popcorn' });
    expect(created.branch_id).toBe(1);
    expect(created.quantity).toBe(10);
    expect(created.status).toBe('IN_STOCK');
  });
});

describe('inventory.controller receive/adjust/deduct', () => {
  it('receive rejects a non-positive quantity', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 5, minimumQuantity: 5, unit: 'pcs' });
    const res = mockRes();
    await inventoryController.receive({ params: { id: item.id }, body: { quantity: 0 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('receive increases quantity and returns the updated item', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 5, minimumQuantity: 5, unit: 'pcs' });
    const res = mockRes();
    await inventoryController.receive({ params: { id: item.id }, body: { quantity: 10 }, account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ quantity: 15 }));
  });

  it('adjust sets the absolute quantity', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 20, minimumQuantity: 5, unit: 'pcs' });
    const res = mockRes();
    await inventoryController.adjust({ params: { id: item.id }, body: { quantity: 12 }, account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ quantity: 12 }));
  });

  it('deduct returns 400 INSUFFICIENT_STOCK rather than going negative', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 3, minimumQuantity: 5, unit: 'pcs' });
    const res = mockRes();
    await inventoryController.deduct({ params: { id: item.id }, body: { quantity: 10 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }));
  });

  it('receive/adjust/deduct return 404 for an unknown item', async () => {
    const res = mockRes();
    await inventoryController.receive({ params: { id: 999 }, body: { quantity: 1 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('inventory.controller getById/getHistory scoping', () => {
  it('getById 403s a Branch Admin who does not own the item branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 1, minimumQuantity: 0, unit: 'pcs' });
    const res = mockRes();
    await inventoryController.getById({ params: { id: item.id }, permissionScope: 'BRANCH', account: { accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('getHistory returns paginated transactions for an owned item', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 10, minimumQuantity: 5, unit: 'pcs' });
    await inventoryRepository.receiveStock(item.id, { quantity: 5, performedBy: 42 });

    const res = mockRes();
    await inventoryController.getHistory(
      { params: { id: item.id }, query: {}, permissionScope: 'BRANCH', account: { accountId: 42 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});
