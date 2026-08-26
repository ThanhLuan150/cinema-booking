const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const inventoryRepository = require('./inventory.repository');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Combo = require('../models/Combo');
const Branch = require('../models/Branch');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('inventory.repository status computation', () => {
  it('create derives IN_STOCK/LOW_STOCK/OUT_OF_STOCK from quantity vs minimum_quantity', async () => {
    const inStock = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 50, minimumQuantity: 10, unit: 'pcs' });
    expect(inStock.status).toBe('IN_STOCK');

    const low = await inventoryRepository.create({ branchId: 1, item: 'Coke', quantity: 5, minimumQuantity: 10, unit: 'pcs' });
    expect(low.status).toBe('LOW_STOCK');

    const out = await inventoryRepository.create({ branchId: 1, item: 'Cup', quantity: 0, minimumQuantity: 10, unit: 'pcs' });
    expect(out.status).toBe('OUT_OF_STOCK');
  });
});

describe('inventory.repository receive/adjust/deduct', () => {
  it('receiveStock increases quantity, recomputes status, and logs a RECEIVE transaction', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 5, minimumQuantity: 10, unit: 'pcs' });
    expect(item.status).toBe('LOW_STOCK');

    const updated = await inventoryRepository.receiveStock(item.id, { quantity: 20, reason: 'restock', performedBy: 42 });
    expect(updated.quantity).toBe(25);
    expect(updated.status).toBe('IN_STOCK');

    const { data, total } = await inventoryRepository.listTransactions(item.id);
    expect(total).toBe(1);
    expect(data[0]).toMatchObject({ type: 'RECEIVE', quantity_change: 20, quantity_before: 5, quantity_after: 25, performed_by: 42 });
  });

  it('adjustStock sets an absolute counted quantity and logs the signed delta', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 20, minimumQuantity: 5, unit: 'pcs' });

    const down = await inventoryRepository.adjustStock(item.id, { quantity: 12, reason: 'stocktake', performedBy: 1 });
    expect(down.quantity).toBe(12);
    let tx = (await inventoryRepository.listTransactions(item.id)).data[0];
    expect(tx).toMatchObject({ type: 'ADJUST', quantity_change: -8, quantity_before: 20, quantity_after: 12 });

    const up = await inventoryRepository.adjustStock(item.id, { quantity: 30, reason: 'found more', performedBy: 1 });
    expect(up.quantity).toBe(30);
    tx = (await inventoryRepository.listTransactions(item.id)).data[0];
    expect(tx).toMatchObject({ type: 'ADJUST', quantity_change: 18, quantity_before: 12, quantity_after: 30 });
  });

  it('deductStock decreases quantity and logs a DEDUCT transaction', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 20, minimumQuantity: 5, unit: 'pcs' });
    const updated = await inventoryRepository.deductStock(item.id, { quantity: 6, reason: 'spoiled', performedBy: 1 });
    expect(updated.quantity).toBe(14);
    const tx = (await inventoryRepository.listTransactions(item.id)).data[0];
    expect(tx).toMatchObject({ type: 'DEDUCT', quantity_change: -6 });
  });

  it('deductStock refuses to go negative', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 5, minimumQuantity: 5, unit: 'pcs' });
    const result = await inventoryRepository.deductStock(item.id, { quantity: 10, reason: 'spoiled', performedBy: 1 });
    expect(result.insufficientStock).toBe(true);
    expect((await Inventory.findOne({ id: item.id })).quantity).toBe(5);
  });

  it('all quantity mutators return null for an unknown id', async () => {
    expect(await inventoryRepository.receiveStock(999, { quantity: 1 })).toBeNull();
    expect(await inventoryRepository.adjustStock(999, { quantity: 1 })).toBeNull();
    expect(await inventoryRepository.deductStock(999, { quantity: 1 })).toBeNull();
  });
});

describe('inventory.repository deductForComboOrder', () => {
  async function seedCombos() {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'Popcorn', price: 30000, type: 'FOOD' },
      { id: 2, cinema_id: 1, name: 'Coke', price: 20000, type: 'BEVERAGE' },
      {
        id: 3,
        cinema_id: 1,
        name: 'Combo Bắp Nước',
        price: 45000,
        type: 'COMBO',
        items: [
          { item_id: 1, quantity: 1 },
          { item_id: 2, quantity: 1 },
        ],
      },
    ]);
  }

  it('decomposes a COMBO-type order line into its bundled FOOD/BEVERAGE items and deducts each', async () => {
    await seedCombos();
    const popcorn = await inventoryRepository.create({ branchId: 1, comboId: 1, item: 'Popcorn', quantity: 50, minimumQuantity: 5, unit: 'pcs' });
    const coke = await inventoryRepository.create({ branchId: 1, comboId: 2, item: 'Coke', quantity: 50, minimumQuantity: 5, unit: 'pcs' });

    const order = {
      code: 'CO-1',
      branch_id: 1,
      items: [{ combo_id: 3, name: 'Combo Bắp Nước', unit_price: 45000, quantity: 2, line_total: 90000 }],
    };
    const results = await inventoryRepository.deductForComboOrder(order);
    expect(results).toHaveLength(2);

    expect((await Inventory.findOne({ id: popcorn.id })).quantity).toBe(48); // 2 combos x 1 popcorn each
    expect((await Inventory.findOne({ id: coke.id })).quantity).toBe(48);
  });

  it('deducts a directly-sold FOOD/BEVERAGE item (not wrapped in a COMBO) by its own combo_id', async () => {
    await seedCombos();
    const popcorn = await inventoryRepository.create({ branchId: 1, comboId: 1, item: 'Popcorn', quantity: 50, minimumQuantity: 5, unit: 'pcs' });

    const order = {
      code: 'CO-2',
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Popcorn', unit_price: 30000, quantity: 3, line_total: 90000 }],
    };
    await inventoryRepository.deductForComboOrder(order);
    expect((await Inventory.findOne({ id: popcorn.id })).quantity).toBe(47);
  });

  it('skips items with no matching Inventory record for that branch, without throwing', async () => {
    await seedCombos();
    const order = {
      code: 'CO-3',
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Popcorn', unit_price: 30000, quantity: 1, line_total: 30000 }],
    };
    await expect(inventoryRepository.deductForComboOrder(order)).resolves.toEqual([]);
  });

  it('is idempotent: calling it twice for the same order never deducts twice', async () => {
    await seedCombos();
    const popcorn = await inventoryRepository.create({ branchId: 1, comboId: 1, item: 'Popcorn', quantity: 50, minimumQuantity: 5, unit: 'pcs' });

    const order = {
      code: 'CO-4',
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Popcorn', unit_price: 30000, quantity: 5, line_total: 150000 }],
    };
    await inventoryRepository.deductForComboOrder(order);
    const secondCallResults = await inventoryRepository.deductForComboOrder(order);

    expect(secondCallResults).toEqual([{ inventoryId: popcorn.id, comboId: 1, skipped: true }]);
    expect((await Inventory.findOne({ id: popcorn.id })).quantity).toBe(45); // deducted once, not twice
    expect(await InventoryTransaction.countDocuments({ ref_type: 'COMBO_ORDER', ref_code: 'CO-4:1' })).toBe(1);
  });

  it('deducting a payment-success order never blocks even if it drives stock negative', async () => {
    await seedCombos();
    const popcorn = await inventoryRepository.create({ branchId: 1, comboId: 1, item: 'Popcorn', quantity: 2, minimumQuantity: 5, unit: 'pcs' });

    const order = {
      code: 'CO-5',
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Popcorn', unit_price: 30000, quantity: 10, line_total: 300000 }],
    };
    await inventoryRepository.deductForComboOrder(order);
    const updated = await Inventory.findOne({ id: popcorn.id });
    expect(updated.quantity).toBe(-8);
    expect(updated.status).toBe('OUT_OF_STOCK');
  });
});

describe('inventory.repository scoping helpers', () => {
  it('findOwnedBranchIds returns only branches owned by that account', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 42, name: 'B', code: 'B' },
      { id: 3, company_id: 1, owner_id: 99, name: 'C', code: 'C' },
    ]);
    const ids = await inventoryRepository.findOwnedBranchIds(42);
    expect(ids.sort()).toEqual([1, 2]);
  });

  it('listLowStock returns only LOW_STOCK/OUT_OF_STOCK items, optionally scoped to branchIds', async () => {
    await inventoryRepository.create({ branchId: 1, item: 'Fine', quantity: 50, minimumQuantity: 5, unit: 'pcs' });
    await inventoryRepository.create({ branchId: 1, item: 'Low', quantity: 3, minimumQuantity: 5, unit: 'pcs' });
    await inventoryRepository.create({ branchId: 2, item: 'Out', quantity: 0, minimumQuantity: 5, unit: 'pcs' });

    const all = await inventoryRepository.listLowStock({});
    expect(all.map((i) => i.item).sort()).toEqual(['Low', 'Out']);

    const scoped = await inventoryRepository.listLowStock({ branchIds: [1] });
    expect(scoped.map((i) => i.item)).toEqual(['Low']);
  });
});

describe('inventory.repository CRUD', () => {
  it('updateFields recomputes status when minimum_quantity changes', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 8, minimumQuantity: 5, unit: 'pcs' });
    expect(item.status).toBe('IN_STOCK');
    const updated = await inventoryRepository.updateFields(item.id, { minimum_quantity: 10 });
    expect(updated.status).toBe('LOW_STOCK');
  });

  it('findBranchIdById resolves the owning branch, or null when missing', async () => {
    const item = await inventoryRepository.create({ branchId: 7, item: 'Popcorn', quantity: 1, minimumQuantity: 0, unit: 'pcs' });
    expect(await inventoryRepository.findBranchIdById(item.id)).toBe(7);
    expect(await inventoryRepository.findBranchIdById(999)).toBeNull();
  });

  it('remove deletes the item', async () => {
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 1, minimumQuantity: 0, unit: 'pcs' });
    await inventoryRepository.remove(item.id);
    expect(await Inventory.countDocuments()).toBe(0);
  });
});
