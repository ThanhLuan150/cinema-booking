const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const inventoryRepository = require('./inventory.repository');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Combo = require('../models/Combo');
const Branch = require('../models/Branch');
const InsufficientStockError = require('../utils/InsufficientStockError');

jest.mock('../utils/socket', () => ({ emitBranchEvent: jest.fn() }));
const { emitBranchEvent } = require('../utils/socket');

beforeAll(async () => {
  await connect();
  // The unique indexes ARE the idempotency/isolation guarantees under test — make sure they exist
  // before the first concurrent write instead of racing Mongoose's background index build.
  await Inventory.init();
  await InventoryTransaction.init();
});
afterEach(async () => {
  emitBranchEvent.mockClear();
  await clearDatabase();
});
afterAll(async () => closeDatabase());

async function makeItem(overrides = {}) {
  return inventoryRepository.create({
    branchId: 1,
    item: 'Popcorn',
    quantity: 20,
    minimumQuantity: 5,
    unit: 'pcs',
    ...overrides,
  });
}

async function quantityOf(id) {
  return (await Inventory.findOne({ id })).quantity;
}

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
    { id: 11, cinema_id: 2, name: 'Popcorn B', price: 30000, type: 'FOOD' },
  ]);
}

function orderOf(code, items, branchId = 1) {
  return {
    code,
    branch_id: branchId,
    items: items.map(([combo_id, quantity]) => ({ combo_id, name: `c${combo_id}`, unit_price: 1, quantity, line_total: quantity })),
  };
}

describe('inventory.repository status computation', () => {
  it('create derives IN_STOCK/LOW_STOCK/OUT_OF_STOCK from quantity vs minimum_quantity', async () => {
    expect((await makeItem({ item: 'A', quantity: 50, minimumQuantity: 10 })).status).toBe('IN_STOCK');
    expect((await makeItem({ item: 'B', quantity: 5, minimumQuantity: 10 })).status).toBe('LOW_STOCK');
    expect((await makeItem({ item: 'C', quantity: 0, minimumQuantity: 10 })).status).toBe('OUT_OF_STOCK');
  });

  it('is LOW_STOCK exactly when stock <= minimum (boundary included), IN_STOCK just above it', async () => {
    expect((await makeItem({ item: 'At', quantity: 10, minimumQuantity: 10 })).status).toBe('LOW_STOCK');
    expect((await makeItem({ item: 'Above', quantity: 11, minimumQuantity: 10 })).status).toBe('IN_STOCK');
  });

  it('crossing the minimum through a sale flips status in the same write', async () => {
    await seedCombos();
    const item = await makeItem({ comboId: 1, quantity: 12, minimumQuantity: 10 });
    expect(item.status).toBe('IN_STOCK');
    await inventoryRepository.deductForComboOrder(orderOf('CO-1', [[1, 2]]));
    expect((await Inventory.findOne({ id: item.id })).status).toBe('LOW_STOCK'); // 10 <= 10
  });
});

describe('inventory.repository catalogue fields', () => {
  it('stores sku, category, cost_price and selling_price', async () => {
    const item = await makeItem({ sku: 'POP-L', category: 'Food', costPrice: 18000, sellingPrice: 55000 });
    expect(item).toMatchObject({ sku: 'POP-L', category: 'Food', cost_price: 18000, selling_price: 55000 });
  });

  it('rejects a duplicate SKU within a branch but allows it in another branch and allows many SKU-less rows', async () => {
    await makeItem({ item: 'A', sku: 'X1' });
    await expect(makeItem({ item: 'B', sku: 'X1' })).rejects.toMatchObject({ code: 11000 });
    await expect(makeItem({ item: 'C', sku: 'X1', branchId: 2 })).resolves.toBeTruthy();
    await makeItem({ item: 'D' });
    await expect(makeItem({ item: 'E' })).resolves.toBeTruthy();
  });

  it('rejects a duplicate item name within a branch', async () => {
    await makeItem({ item: 'Popcorn' });
    await expect(makeItem({ item: 'Popcorn' })).rejects.toMatchObject({ code: 11000 });
    await expect(makeItem({ item: 'Popcorn', branchId: 2 })).resolves.toBeTruthy();
  });

  it('lets a branch track a given combo item only once', async () => {
    await makeItem({ item: 'A', comboId: 1 });
    await expect(makeItem({ item: 'B', comboId: 1 })).rejects.toMatchObject({ code: 11000 });
    await expect(makeItem({ item: 'B', comboId: 1, branchId: 2 })).resolves.toBeTruthy();
  });

  it('filters by category and by name/SKU search', async () => {
    await makeItem({ item: 'Popcorn', sku: 'POP', category: 'Food' });
    await makeItem({ item: 'Pepsi', sku: 'PEPSI', category: 'Beverage' });
    expect((await inventoryRepository.list({ category: 'Beverage' })).data.map((i) => i.item)).toEqual(['Pepsi']);
    expect((await inventoryRepository.list({ search: 'pop' })).data.map((i) => i.item)).toEqual(['Popcorn']);
    expect((await inventoryRepository.list({ search: 'a.*' })).total).toBe(0); // regex chars are escaped
    expect(await inventoryRepository.listCategories()).toEqual(['Beverage', 'Food']);
  });
});

describe('inventory.repository stock movements', () => {
  it('importStock increases quantity, recomputes status, and logs an IMPORT', async () => {
    const item = await makeItem({ quantity: 5, minimumQuantity: 10 });
    expect(item.status).toBe('LOW_STOCK');

    const updated = await inventoryRepository.importStock(item.id, { quantity: 20, reason: 'restock', performedBy: 42 });
    expect(updated.quantity).toBe(25);
    expect(updated.status).toBe('IN_STOCK');
    expect((await Inventory.findOne({ id: item.id })).status).toBe('IN_STOCK');

    const { data, total } = await inventoryRepository.listTransactions(item.id);
    expect(total).toBe(1);
    expect(data[0]).toMatchObject({ type: 'IMPORT', quantity_change: 20, quantity_before: 5, quantity_after: 25, performed_by: 42 });
  });

  it('returnStock puts goods back and logs a RETURN', async () => {
    const item = await makeItem({ quantity: 5 });
    const updated = await inventoryRepository.returnStock(item.id, { quantity: 2, reason: 'customer returned', performedBy: 1 });
    expect(updated.quantity).toBe(7);
    const tx = (await inventoryRepository.listTransactions(item.id)).data[0];
    expect(tx).toMatchObject({ type: 'RETURN', quantity_change: 2, quantity_before: 5, quantity_after: 7 });
  });

  it('adjustStock sets an absolute counted quantity and logs the signed delta as ADJUSTMENT', async () => {
    const item = await makeItem({ quantity: 20, minimumQuantity: 5 });

    const down = await inventoryRepository.adjustStock(item.id, { quantity: 12, reason: 'stocktake', performedBy: 1 });
    expect(down.quantity).toBe(12);
    let tx = (await inventoryRepository.listTransactions(item.id)).data[0];
    expect(tx).toMatchObject({ type: 'ADJUSTMENT', quantity_change: -8, quantity_before: 20, quantity_after: 12 });

    const up = await inventoryRepository.adjustStock(item.id, { quantity: 30, reason: 'found more', performedBy: 1 });
    expect(up.quantity).toBe(30);
    tx = (await inventoryRepository.listTransactions(item.id)).data[0];
    expect(tx).toMatchObject({ type: 'ADJUSTMENT', quantity_change: 18, quantity_before: 12, quantity_after: 30 });
  });

  it('adjustStock accepts a counted zero and marks the item OUT_OF_STOCK', async () => {
    const item = await makeItem({ quantity: 20 });
    const updated = await inventoryRepository.adjustStock(item.id, { quantity: 0 });
    expect(updated.quantity).toBe(0);
    expect(updated.status).toBe('OUT_OF_STOCK');
  });

  it('wasteStock decreases quantity and logs a WASTE', async () => {
    const item = await makeItem({ quantity: 20 });
    const updated = await inventoryRepository.wasteStock(item.id, { quantity: 6, reason: 'spoiled', performedBy: 1 });
    expect(updated.quantity).toBe(14);
    const tx = (await inventoryRepository.listTransactions(item.id)).data[0];
    expect(tx).toMatchObject({ type: 'WASTE', quantity_change: -6, reason: 'spoiled' });
  });

  it('wasteStock refuses to go negative, reports what is available, and logs nothing', async () => {
    const item = await makeItem({ quantity: 5, minimumQuantity: 5 });
    const result = await inventoryRepository.wasteStock(item.id, { quantity: 10, reason: 'spoiled', performedBy: 1 });
    expect(result).toEqual({ insufficientStock: true, available: 5, item: 'Popcorn' });
    expect(await quantityOf(item.id)).toBe(5);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });

  it('wasting exactly the remaining stock is allowed (boundary)', async () => {
    const item = await makeItem({ quantity: 5 });
    const updated = await inventoryRepository.wasteStock(item.id, { quantity: 5 });
    expect(updated.quantity).toBe(0);
    expect(updated.status).toBe('OUT_OF_STOCK');
  });

  it('all movement functions return null for an unknown id', async () => {
    expect(await inventoryRepository.importStock(999, { quantity: 1 })).toBeNull();
    expect(await inventoryRepository.returnStock(999, { quantity: 1 })).toBeNull();
    expect(await inventoryRepository.adjustStock(999, { quantity: 1 })).toBeNull();
    expect(await inventoryRepository.wasteStock(999, { quantity: 1 })).toBeNull();
  });

  it('broadcasts the change with lowStock=true only on the transition INTO low stock', async () => {
    const item = await makeItem({ quantity: 12, minimumQuantity: 10 });
    await inventoryRepository.wasteStock(item.id, { quantity: 3 }); // 12 -> 9: crosses the minimum
    expect(emitBranchEvent).toHaveBeenLastCalledWith(
      1,
      'inventory:updated',
      expect.objectContaining({ status: 'LOW_STOCK', previousStatus: 'IN_STOCK', lowStock: true }),
    );
    await inventoryRepository.wasteStock(item.id, { quantity: 1 }); // 9 -> 8: already low
    expect(emitBranchEvent).toHaveBeenLastCalledWith(1, 'inventory:updated', expect.objectContaining({ lowStock: false }));
  });

  it('stamps updatedAt on movements (pipeline updates still honour timestamps)', async () => {
    const item = await makeItem();
    const before = (await Inventory.findOne({ id: item.id })).updatedAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await inventoryRepository.importStock(item.id, { quantity: 1 });
    expect((await Inventory.findOne({ id: item.id })).updatedAt.getTime()).toBeGreaterThan(before);
  });

  it('listTransactions filters by movement type', async () => {
    const item = await makeItem();
    await inventoryRepository.importStock(item.id, { quantity: 1 });
    await inventoryRepository.wasteStock(item.id, { quantity: 1 });
    const { data, total } = await inventoryRepository.listTransactions(item.id, { type: 'WASTE' });
    expect(total).toBe(1);
    expect(data[0].type).toBe('WASTE');
  });
});

describe('inventory.repository deductForComboOrder (SALE)', () => {
  it('decomposes a COMBO-type order line into its bundled FOOD/BEVERAGE items and deducts each', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    const coke = await makeItem({ item: 'Coke', comboId: 2, quantity: 50 });

    const results = await inventoryRepository.deductForComboOrder(orderOf('CO-1', [[3, 2]]));
    expect(results).toHaveLength(2);
    expect(await quantityOf(popcorn.id)).toBe(48); // 2 combos x 1 popcorn each
    expect(await quantityOf(coke.id)).toBe(48);
  });

  it('logs each deduction as a SALE tied to the order', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    await inventoryRepository.deductForComboOrder(orderOf('CO-9', [[1, 3]]));
    const tx = (await inventoryRepository.listTransactions(popcorn.id)).data[0];
    expect(tx).toMatchObject({
      type: 'SALE',
      quantity_change: -3,
      quantity_before: 50,
      quantity_after: 47,
      ref_type: 'COMBO_ORDER',
      ref_code: 'CO-9:1',
      performed_by: null,
    });
  });

  it('deducts a directly-sold FOOD/BEVERAGE item (not wrapped in a COMBO) by its own combo_id', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    await inventoryRepository.deductForComboOrder(orderOf('CO-2', [[1, 3]]));
    expect(await quantityOf(popcorn.id)).toBe(47);
  });

  it('skips items with no matching Inventory record for that branch, without throwing', async () => {
    await seedCombos();
    await expect(inventoryRepository.deductForComboOrder(orderOf('CO-3', [[1, 1]]))).resolves.toEqual([]);
  });

  it('is idempotent: calling it twice for the same order never deducts twice', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    const order = orderOf('CO-4', [[1, 5]]);
    await inventoryRepository.deductForComboOrder(order);
    const second = await inventoryRepository.deductForComboOrder(order);

    expect(second).toEqual([{ inventoryId: popcorn.id, comboId: 1, skipped: true }]);
    expect(await quantityOf(popcorn.id)).toBe(45);
    expect(await InventoryTransaction.countDocuments({ ref_type: 'COMBO_ORDER', ref_code: 'CO-4:1' })).toBe(1);
  });

  it('refuses to oversell: throws InsufficientStockError, stock unchanged, no ledger row', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 2 });
    const error = await inventoryRepository.deductForComboOrder(orderOf('CO-5', [[1, 10]])).catch((e) => e);

    expect(error).toBeInstanceOf(InsufficientStockError);
    expect(error).toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK' });
    expect(error.shortages).toEqual([
      { combo_id: 1, inventory_id: popcorn.id, item: 'Popcorn', requested: 10, available: 2 },
    ]);
    expect(await quantityOf(popcorn.id)).toBe(2);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });

  it('is all-or-nothing across lines: a short second line puts the first back and leaves no trace', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    const coke = await makeItem({ item: 'Coke', comboId: 2, quantity: 1 });

    await expect(inventoryRepository.deductForComboOrder(orderOf('CO-6', [[3, 2]]))).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await quantityOf(popcorn.id)).toBe(50);
    expect(await quantityOf(coke.id)).toBe(1);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
    // The refused sale can be retried once stock arrives — its claim was withdrawn, not left behind.
    await inventoryRepository.importStock(coke.id, { quantity: 5 });
    await expect(inventoryRepository.deductForComboOrder(orderOf('CO-6', [[3, 2]]))).resolves.toHaveLength(2);
  });

  it('allowShortfall deducts down to zero, never negative, and records what was really taken', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 2, minimumQuantity: 5 });
    const results = await inventoryRepository.deductForComboOrder(orderOf('CO-7', [[1, 10]]), { allowShortfall: true });

    const updated = await Inventory.findOne({ id: popcorn.id });
    expect(updated.quantity).toBe(0);
    expect(updated.status).toBe('OUT_OF_STOCK');
    expect(results[0]).toMatchObject({ quantityDeducted: 2, shortfall: 8 });
    const tx = (await inventoryRepository.listTransactions(popcorn.id)).data[0];
    expect(tx).toMatchObject({ type: 'SALE', quantity_change: -2, quantity_before: 2, quantity_after: 0 });
  });

  it('only ever touches the order\'s own branch: Branch A stock is never used by a Branch B sale', async () => {
    await seedCombos();
    const stockA = await makeItem({ branchId: 1, comboId: 1, quantity: 50 });
    const stockB = await makeItem({ branchId: 2, comboId: 11, item: 'Popcorn', quantity: 4 });

    await inventoryRepository.deductForComboOrder(orderOf('CO-8', [[11, 3]], 2));
    expect(await quantityOf(stockA.id)).toBe(50);
    expect(await quantityOf(stockB.id)).toBe(1);

    // Branch B has only 1 left; Branch A's plentiful stock must not rescue the sale.
    await expect(inventoryRepository.deductForComboOrder(orderOf('CO-10', [[11, 3]], 2))).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await quantityOf(stockA.id)).toBe(50);
  });
});

describe('inventory.repository restockForComboOrder (RETURN)', () => {
  it('puts back exactly what the sale deducted and logs RETURN rows', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    const coke = await makeItem({ item: 'Coke', comboId: 2, quantity: 50 });
    const order = orderOf('CO-20', [[3, 4]]);
    await inventoryRepository.deductForComboOrder(order);
    expect(await quantityOf(popcorn.id)).toBe(46);

    await inventoryRepository.restockForComboOrder(order, { performedBy: 7 });
    expect(await quantityOf(popcorn.id)).toBe(50);
    expect(await quantityOf(coke.id)).toBe(50);
    const tx = (await inventoryRepository.listTransactions(popcorn.id, { type: 'RETURN' })).data[0];
    expect(tx).toMatchObject({ type: 'RETURN', quantity_change: 4, quantity_before: 46, quantity_after: 50, performed_by: 7 });
  });

  it('is idempotent: restocking twice returns the stock once', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    const order = orderOf('CO-21', [[1, 4]]);
    await inventoryRepository.deductForComboOrder(order);
    await inventoryRepository.restockForComboOrder(order);
    const second = await inventoryRepository.restockForComboOrder(order);
    expect(second.every((r) => r.skipped)).toBe(true);
    expect(await quantityOf(popcorn.id)).toBe(50);
  });

  it('is a no-op for an order that never deducted anything', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    await expect(inventoryRepository.restockForComboOrder(orderOf('CO-22', [[1, 4]]))).resolves.toEqual([]);
    expect(await quantityOf(popcorn.id)).toBe(50);
  });

  it('returns only the clamped amount when the sale was a partial (shortfall) deduction', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 2 });
    const order = orderOf('CO-23', [[1, 10]]);
    await inventoryRepository.deductForComboOrder(order, { allowShortfall: true });
    await inventoryRepository.restockForComboOrder(order);
    expect(await quantityOf(popcorn.id)).toBe(2); // 2 taken, 2 returned — not 10
  });

  it('does not confuse order codes that share a prefix (CO-1 vs CO-12)', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    await inventoryRepository.deductForComboOrder(orderOf('CO-12', [[1, 5]]));
    await inventoryRepository.restockForComboOrder(orderOf('CO-1', [[1, 5]]));
    expect(await quantityOf(popcorn.id)).toBe(45);
  });
});

describe('inventory.repository availability checks', () => {
  it('findShortages lists every short tracked line and ignores untracked items', async () => {
    await seedCombos();
    await makeItem({ comboId: 1, quantity: 2 });
    await makeItem({ item: 'Coke', comboId: 2, quantity: 1 });
    const shortages = await inventoryRepository.findShortages(1, orderOf('x', [[3, 5]]).items);
    expect(shortages.map((s) => [s.item, s.requested, s.available])).toEqual([
      ['Popcorn', 5, 2],
      ['Coke', 5, 1],
    ]);
    expect(await inventoryRepository.findShortages(1, orderOf('x', [[3, 1]]).items)).toEqual([]);
  });

  it('assertAvailableForComboIds counts a repeated id as quantity', async () => {
    await seedCombos();
    await makeItem({ comboId: 1, quantity: 2 });
    await expect(inventoryRepository.assertAvailableForComboIds(1, [1, 1])).resolves.toBeUndefined();
    await expect(inventoryRepository.assertAvailableForComboIds(1, [1, 1, 1])).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    await expect(inventoryRepository.assertAvailableForComboIds(1, [])).resolves.toBeUndefined();
  });
});

// The ticket's core hard requirement. These fire genuinely concurrent operations at a real
// (in-memory) mongod — no mocking — and assert the invariants that a read-modify-write
// implementation would break.
describe('inventory.repository concurrency', () => {
  it('N concurrent strict sales of the last units: exactly `stock` succeed, the rest are refused, never negative', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 5, minimumQuantity: 2 });

    const attempts = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) => inventoryRepository.deductForComboOrder(orderOf(`CO-C${i}`, [[1, 1]]))),
    );
    const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
    const refused = attempts.filter((a) => a.status === 'rejected');

    expect(fulfilled).toHaveLength(5);
    expect(refused).toHaveLength(20);
    expect(refused.every((a) => a.reason instanceof InsufficientStockError)).toBe(true);

    const final = await Inventory.findOne({ id: popcorn.id });
    expect(final.quantity).toBe(0);
    expect(final.status).toBe('OUT_OF_STOCK');
    expect(await InventoryTransaction.countDocuments({ type: 'SALE' })).toBe(5);
  });

  it('concurrent multi-unit sales never oversell: total sold <= stock and ledger matches stock', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 10 });

    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => inventoryRepository.deductForComboOrder(orderOf(`CO-M${i}`, [[1, 3]]))),
    );
    const sold = attempts.filter((a) => a.status === 'fulfilled').length * 3;
    expect(sold).toBe(9); // three 3-unit orders fit in 10; a fourth would need 12
    expect(await quantityOf(popcorn.id)).toBe(10 - sold);
    const ledgerTotal = (await InventoryTransaction.find({ type: 'SALE' })).reduce((s, t) => s + t.quantity_change, 0);
    expect(ledgerTotal).toBe(-sold);
  });

  it('concurrent multi-line orders can be refused but can never oversell either ingredient', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 3 });
    const coke = await makeItem({ item: 'Coke', comboId: 2, quantity: 3 });

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => inventoryRepository.deductForComboOrder(orderOf(`CO-L${i}`, [[3, 1]]))),
    );
    const sold = attempts.filter((a) => a.status === 'fulfilled').length;
    expect(sold).toBeLessThanOrEqual(3);
    // Whatever was sold, both shelves moved in lock-step and neither went below zero — no
    // half-applied order (popcorn taken, coke refused) is left behind by the rollback.
    expect(await quantityOf(popcorn.id)).toBe(3 - sold);
    expect(await quantityOf(coke.id)).toBe(3 - sold);
    expect(await InventoryTransaction.countDocuments({ type: 'SALE' })).toBe(sold * 2);
  });

  it('the same order processed concurrently deducts once', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    const order = orderOf('CO-DUP', [[1, 4]]);
    await Promise.allSettled(Array.from({ length: 8 }, () => inventoryRepository.deductForComboOrder(order)));
    expect(await quantityOf(popcorn.id)).toBe(46);
    expect(await InventoryTransaction.countDocuments({ ref_code: 'CO-DUP:1' })).toBe(1);
  });

  it('concurrent manual write-offs cannot drive quantity negative', async () => {
    const item = await makeItem({ quantity: 4 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => inventoryRepository.wasteStock(item.id, { quantity: 1 })),
    );
    expect(results.filter((r) => r.insufficientStock)).toHaveLength(6);
    expect(await quantityOf(item.id)).toBe(0);
    expect(await InventoryTransaction.countDocuments({ type: 'WASTE' })).toBe(4);
  });

  it('concurrent imports and write-offs all land: final quantity == start + sum of applied changes', async () => {
    const item = await makeItem({ quantity: 100 });
    await Promise.all([
      ...Array.from({ length: 15 }, () => inventoryRepository.importStock(item.id, { quantity: 3 })),
      ...Array.from({ length: 10 }, () => inventoryRepository.wasteStock(item.id, { quantity: 2 })),
    ]);
    expect(await quantityOf(item.id)).toBe(100 + 45 - 20);
    const { data } = await inventoryRepository.listTransactions(item.id, { limit: 100 });
    expect(data.reduce((sum, t) => sum + t.quantity_change, 0)).toBe(25);
    // Every row's before/after is an exact pre/post image of its own atomic write.
    expect(data.every((t) => t.quantity_after - t.quantity_before === t.quantity_change)).toBe(true);
    expect(data.every((t) => t.quantity_after >= 0)).toBe(true);
  });

  it('a stocktake racing sales is recorded with the true pre-image delta', async () => {
    await seedCombos();
    const popcorn = await makeItem({ comboId: 1, quantity: 50 });
    await Promise.all([
      inventoryRepository.deductForComboOrder(orderOf('CO-R1', [[1, 5]])),
      inventoryRepository.adjustStock(popcorn.id, { quantity: 30 }),
    ]);
    const rows = (await inventoryRepository.listTransactions(popcorn.id, { limit: 10 })).data;
    expect(rows.every((t) => t.quantity_after - t.quantity_before === t.quantity_change)).toBe(true);
    const finalQuantity = await quantityOf(popcorn.id);
    // Either the sale ran first (50->45 then set 30) or the count ran first (set 30 then 30->25).
    expect([30, 25]).toContain(finalQuantity);
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
    await makeItem({ item: 'Fine', quantity: 50 });
    await makeItem({ item: 'Low', quantity: 3 });
    await makeItem({ item: 'Out', quantity: 0, branchId: 2 });

    const all = await inventoryRepository.listLowStock({});
    expect(all.map((i) => i.item).sort()).toEqual(['Low', 'Out']);

    const scoped = await inventoryRepository.listLowStock({ branchIds: [1] });
    expect(scoped.map((i) => i.item)).toEqual(['Low']);
  });

  it('list is confined to the given branchIds', async () => {
    await makeItem({ item: 'A', branchId: 1 });
    await makeItem({ item: 'B', branchId: 2 });
    const { data } = await inventoryRepository.list({ branchIds: [2] });
    expect(data.map((i) => i.item)).toEqual(['B']);
  });
});

describe('inventory.repository CRUD', () => {
  it('updateFields recomputes status when minimum_quantity changes', async () => {
    const item = await makeItem({ quantity: 8, minimumQuantity: 5 });
    expect(item.status).toBe('IN_STOCK');
    const updated = await inventoryRepository.updateFields(item.id, { minimum_quantity: 10 });
    expect(updated.status).toBe('LOW_STOCK');
  });

  it('updateFields stores a "$"-prefixed string literally rather than as a field path', async () => {
    const item = await makeItem();
    const updated = await inventoryRepository.updateFields(item.id, { item: '$quantity', category: '$$ROOT' });
    expect(updated.item).toBe('$quantity');
    expect(updated.category).toBe('$$ROOT');
  });

  it('updateFields never touches quantity', async () => {
    const item = await makeItem({ quantity: 20 });
    await inventoryRepository.updateFields(item.id, { selling_price: 99 });
    expect(await quantityOf(item.id)).toBe(20);
  });

  it('updateFields returns null for an unknown id', async () => {
    expect(await inventoryRepository.updateFields(999, { item: 'x' })).toBeNull();
  });

  it('findBranchIdById resolves the owning branch, or null when missing', async () => {
    const item = await makeItem({ branchId: 7 });
    expect(await inventoryRepository.findBranchIdById(item.id)).toBe(7);
    expect(await inventoryRepository.findBranchIdById(999)).toBeNull();
  });

  it('remove deletes the item', async () => {
    const item = await makeItem();
    await inventoryRepository.remove(item.id);
    expect(await Inventory.countDocuments()).toBe(0);
  });
});
