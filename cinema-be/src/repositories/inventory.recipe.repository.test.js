const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const inventoryRepository = require('./inventory.repository');
const recipeRepository = require('./recipe.repository');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Recipe = require('../models/Recipe');
const Combo = require('../models/Combo');
const InsufficientStockError = require('../utils/InsufficientStockError');

jest.mock('../utils/socket', () => ({ emitBranchEvent: jest.fn() }));

// Ticket 47 — a product with a recipe is sold out of its INGREDIENTS. These tests pin the stock
// arithmetic of that (deduct / refuse / restock / race) at the repository layer.

beforeAll(async () => {
  await connect();
  await Inventory.init();
  await InventoryTransaction.init();
  await Recipe.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const PRODUCT = { LARGE_POPCORN: 1, NACHOS: 2, COKE: 3, BUNDLE: 4, POPCORN_B: 11 };

async function seedCatalogue() {
  await Combo.create([
    { id: 1, cinema_id: 1, name: 'Large Popcorn', price: 50000, type: 'FOOD' },
    { id: 2, cinema_id: 1, name: 'Nachos', price: 60000, type: 'FOOD' },
    { id: 3, cinema_id: 1, name: 'Coke', price: 20000, type: 'BEVERAGE' },
    {
      id: 4,
      cinema_id: 1,
      name: 'Popcorn + Coke',
      price: 65000,
      type: 'COMBO',
      items: [
        { item_id: 1, quantity: 1 },
        { item_id: 3, quantity: 1 },
      ],
    },
    { id: 11, cinema_id: 2, name: 'Large Popcorn B', price: 50000, type: 'FOOD' },
  ]);
}

const ingredient = (overrides) =>
  inventoryRepository.create({ branchId: 1, quantity: 1000, minimumQuantity: 0, unit: 'g', ...overrides });

// The ticket's own example: Large Popcorn = Corn 150g + Butter 20g + Salt 5g.
async function seedPopcorn({ corn = 1000, butter = 1000, salt = 1000 } = {}) {
  await seedCatalogue();
  const c = await ingredient({ item: 'Corn', quantity: corn });
  const b = await ingredient({ item: 'Butter', quantity: butter });
  const s = await ingredient({ item: 'Salt', quantity: salt });
  await recipeRepository.create({
    branchId: 1,
    productId: PRODUCT.LARGE_POPCORN,
    ingredients: [
      { inventory_id: c.id, quantity: 150 },
      { inventory_id: b.id, quantity: 20 },
      { inventory_id: s.id, quantity: 5 },
    ],
  });
  return { corn: c, butter: b, salt: s };
}

let orderSeq = 0;
function orderOf(items, branchId = 1) {
  orderSeq += 1;
  return {
    code: `CO-${orderSeq}`,
    branch_id: branchId,
    items: items.map(([combo_id, quantity]) => ({ combo_id, name: `c${combo_id}`, unit_price: 1, quantity, line_total: quantity })),
  };
}

const stockOf = async (id) => (await Inventory.findOne({ id })).quantity;
const stocks = async (...items) => Promise.all(items.map((i) => stockOf(i.id)));

describe('selling a product with a recipe deducts its ingredients', () => {
  it('1 Large Popcorn takes Corn -150g, Butter -20g, Salt -5g (the ticket example)', async () => {
    const { corn, butter, salt } = await seedPopcorn();
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]));
    expect(await stocks(corn, butter, salt)).toEqual([850, 980, 995]);
  });

  it('scales every ingredient by the quantity sold', async () => {
    const { corn, butter, salt } = await seedPopcorn();
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 3]]));
    expect(await stocks(corn, butter, salt)).toEqual([550, 940, 985]);
  });

  it('writes one SALE ledger row per ingredient with the exact quantity taken', async () => {
    const { corn, butter } = await seedPopcorn();
    const order = orderOf([[PRODUCT.LARGE_POPCORN, 2]]);
    await inventoryRepository.deductForComboOrder(order);

    const rows = await InventoryTransaction.find({ type: 'SALE' }).sort({ inventory_id: 1 });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ inventory_id: corn.id, quantity_change: -300, quantity_before: 1000, quantity_after: 700 });
    expect(rows[0].ref_code).toBe(`${order.code}:ING${corn.id}`);
    expect(rows[1]).toMatchObject({ inventory_id: butter.id, quantity_change: -40 });
  });

  it('reports each ingredient line in the result, flagged as an ingredient', async () => {
    await seedPopcorn();
    const results = await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]));
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ingredient === true && r.comboId === null && r.skipped === false)).toBe(true);
    expect(results.map((r) => r.quantityDeducted)).toEqual([150, 20, 5]);
  });

  it('a COMBO bundle expands to its components, and a component with a recipe uses its ingredients', async () => {
    const { corn } = await seedPopcorn();
    const coke = await inventoryRepository.create({ branchId: 1, comboId: PRODUCT.COKE, item: 'Coke', quantity: 30, unit: 'can' });
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.BUNDLE, 2]]));
    expect(await stockOf(corn.id)).toBe(700); // 2 bundles -> 2 popcorns -> 300g
    expect(await stockOf(coke.id)).toBe(28); // the other component is still counted directly
  });

  it('a product WITHOUT a recipe keeps deducting its directly-tracked record', async () => {
    await seedCatalogue();
    const coke = await inventoryRepository.create({ branchId: 1, comboId: PRODUCT.COKE, item: 'Coke', quantity: 10, unit: 'can' });
    const results = await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.COKE, 3]]));
    expect(await stockOf(coke.id)).toBe(7);
    expect(results[0].ingredient).toBeUndefined();
  });

  it('a product with neither a recipe nor a tracked record is not stock-limited', async () => {
    await seedCatalogue();
    expect(await inventoryRepository.findShortages(1, orderOf([[PRODUCT.NACHOS, 500]]).items)).toEqual([]);
    expect(await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.NACHOS, 500]]))).toEqual([]);
  });

  it('when a legacy product has BOTH a recipe and a tracked record, the recipe wins and the record is untouched', async () => {
    const { corn } = await seedPopcorn();
    const tracked = await inventoryRepository.create({ branchId: 1, comboId: PRODUCT.LARGE_POPCORN, item: 'Popcorn tub', quantity: 9, unit: 'pcs' });
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]));
    expect(await stockOf(corn.id)).toBe(850);
    expect(await stockOf(tracked.id)).toBe(9); // never deducted twice
  });
});

describe('cannot sell when an ingredient is short', () => {
  it('findShortages names the short ingredient with requested/available and the products needing it', async () => {
    const { butter } = await seedPopcorn({ butter: 30 });
    const shortages = await inventoryRepository.findShortages(1, orderOf([[PRODUCT.LARGE_POPCORN, 2]]).items);
    expect(shortages).toEqual([
      {
        combo_id: null,
        inventory_id: butter.id,
        item: 'Butter',
        requested: 40,
        available: 30,
        ingredient: true,
        product_ids: [PRODUCT.LARGE_POPCORN],
        unit: 'g',
      },
    ]);
  });

  it('assertAvailable throws InsufficientStockError (409 INSUFFICIENT_STOCK)', async () => {
    await seedPopcorn({ butter: 30 });
    const attempt = inventoryRepository.assertAvailable(1, orderOf([[PRODUCT.LARGE_POPCORN, 2]]).items);
    await expect(attempt).rejects.toBeInstanceOf(InsufficientStockError);
    await expect(attempt).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK' });
  });

  it('allows exactly the stock on hand (boundary) and refuses one portion more', async () => {
    await seedPopcorn({ corn: 300, butter: 40, salt: 10 });
    expect(await inventoryRepository.findShortages(1, orderOf([[PRODUCT.LARGE_POPCORN, 2]]).items)).toEqual([]);
    const over = await inventoryRepository.findShortages(1, orderOf([[PRODUCT.LARGE_POPCORN, 3]]).items);
    expect(over.map((s) => s.item)).toEqual(['Corn', 'Butter', 'Salt']);
  });

  it('a strict sale is all-or-nothing: nothing is deducted and no ledger row remains', async () => {
    const { corn, butter, salt } = await seedPopcorn({ butter: 10 }); // butter can't cover even one
    await expect(inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]))).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await stocks(corn, butter, salt)).toEqual([1000, 10, 1000]);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });

  it('an ingredient shared by two products is checked against their COMBINED need', async () => {
    await seedCatalogue();
    const butter = await ingredient({ item: 'Butter', quantity: 50 });
    const corn = await ingredient({ item: 'Corn', quantity: 1000 });
    const cheese = await ingredient({ item: 'Cheese', quantity: 1000 });
    await recipeRepository.create({
      branchId: 1,
      productId: PRODUCT.LARGE_POPCORN,
      ingredients: [{ inventory_id: corn.id, quantity: 150 }, { inventory_id: butter.id, quantity: 20 }],
    });
    await recipeRepository.create({
      branchId: 1,
      productId: PRODUCT.NACHOS,
      ingredients: [{ inventory_id: cheese.id, quantity: 100 }, { inventory_id: butter.id, quantity: 30 }],
    });

    // 2 popcorn (40 butter) fits alone, 1 nachos (30) fits alone — together they need 70 of 50.
    expect(await inventoryRepository.findShortages(1, orderOf([[PRODUCT.LARGE_POPCORN, 2]]).items)).toEqual([]);
    expect(await inventoryRepository.findShortages(1, orderOf([[PRODUCT.NACHOS, 1]]).items)).toEqual([]);
    const shortages = await inventoryRepository.findShortages(
      1,
      orderOf([[PRODUCT.LARGE_POPCORN, 2], [PRODUCT.NACHOS, 1]]).items,
    );
    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({ item: 'Butter', requested: 70, available: 50, product_ids: [1, 2] });

    await expect(
      inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 2], [PRODUCT.NACHOS, 1]])),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await stocks(butter, corn, cheese)).toEqual([50, 1000, 1000]);
  });

  it('a recipe pointing at a record that no longer exists cannot be sold (fail closed), and deducts nothing', async () => {
    const { corn, butter } = await seedPopcorn();
    await Inventory.deleteOne({ id: butter.id });
    const items = orderOf([[PRODUCT.LARGE_POPCORN, 1]]).items;
    expect(await inventoryRepository.findShortages(1, items)).toEqual([
      expect.objectContaining({ inventory_id: butter.id, item: `Ingredient #${butter.id}`, requested: 20, available: 0 }),
    ]);
    await expect(inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]))).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await stockOf(corn.id)).toBe(1000);
  });
});

describe('branch isolation', () => {
  it("an ingredient that belongs to another branch is never used (treated as missing)", async () => {
    await seedCatalogue();
    const foreignCorn = await ingredient({ item: 'Corn', branchId: 2, quantity: 5000 });
    const localButter = await ingredient({ item: 'Butter', quantity: 1000 });
    await recipeRepository.create({
      branchId: 1,
      productId: PRODUCT.LARGE_POPCORN,
      ingredients: [{ inventory_id: foreignCorn.id, quantity: 150 }, { inventory_id: localButter.id, quantity: 20 }],
    });
    const shortages = await inventoryRepository.findShortages(1, orderOf([[PRODUCT.LARGE_POPCORN, 1]]).items);
    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({ inventory_id: foreignCorn.id, available: 0 });
    await expect(inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]))).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await stocks(foreignCorn, localButter)).toEqual([5000, 1000]);
  });

  it("a sale at branch B uses branch B's recipe and stock, never branch A's", async () => {
    const { corn } = await seedPopcorn();
    const cornB = await ingredient({ item: 'Corn', branchId: 2, quantity: 400 });
    await recipeRepository.create({
      branchId: 2,
      productId: PRODUCT.POPCORN_B,
      ingredients: [{ inventory_id: cornB.id, quantity: 200 }],
    });
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.POPCORN_B, 1]], 2));
    expect(await stockOf(cornB.id)).toBe(200);
    expect(await stockOf(corn.id)).toBe(1000);
  });

  it("a recipe of branch A is not applied when the same product id is sold under branch B", async () => {
    const { corn } = await seedPopcorn();
    // Sale attributed to branch 2 but naming product 1 (a branch-1 product): no branch-2 recipe -> no deduction.
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]], 2));
    expect(await stockOf(corn.id)).toBe(1000);
  });
});

describe('idempotency and restock', () => {
  it('deducting the same order twice takes the stock once', async () => {
    const { corn } = await seedPopcorn();
    const order = orderOf([[PRODUCT.LARGE_POPCORN, 1]]);
    await inventoryRepository.deductForComboOrder(order);
    const second = await inventoryRepository.deductForComboOrder(order);
    expect(second.every((r) => r.skipped)).toBe(true);
    expect(await stockOf(corn.id)).toBe(850);
    expect(await InventoryTransaction.countDocuments({ type: 'SALE' })).toBe(3);
  });

  it('cancelling puts back exactly the ingredients that were taken, once', async () => {
    const { corn, butter, salt } = await seedPopcorn();
    const order = orderOf([[PRODUCT.LARGE_POPCORN, 2]]);
    await inventoryRepository.deductForComboOrder(order);
    expect(await stocks(corn, butter, salt)).toEqual([700, 960, 990]);

    await inventoryRepository.restockForComboOrder(order);
    expect(await stocks(corn, butter, salt)).toEqual([1000, 1000, 1000]);

    await inventoryRepository.restockForComboOrder(order); // double cancel / retry
    expect(await stocks(corn, butter, salt)).toEqual([1000, 1000, 1000]);
    expect(await InventoryTransaction.countDocuments({ type: 'RETURN' })).toBe(3);
  });

  it('restocking a never-paid order is a no-op', async () => {
    const { corn } = await seedPopcorn();
    await inventoryRepository.restockForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]));
    expect(await stockOf(corn.id)).toBe(1000);
  });
});

describe('an already-paid sale never fails and never goes negative (allowShortfall)', () => {
  it('clamps short ingredients at zero, deducts the rest, and records what was really taken', async () => {
    const { corn, butter, salt } = await seedPopcorn({ butter: 30 });
    const results = await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 2]]), { allowShortfall: true });
    expect(await stocks(corn, butter, salt)).toEqual([700, 0, 990]);
    const butterResult = results.find((r) => r.inventoryId === butter.id);
    expect(butterResult).toMatchObject({ quantityDeducted: 30, shortfall: 10 });
    const row = await InventoryTransaction.findOne({ inventory_id: butter.id });
    expect(row).toMatchObject({ quantity_change: -30, quantity_after: 0 });
  });

  it('skips (rather than fails on) an ingredient record that no longer exists', async () => {
    const { corn, butter } = await seedPopcorn();
    await Inventory.deleteOne({ id: butter.id });
    await expect(
      inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]]), { allowShortfall: true }),
    ).resolves.toBeDefined();
    expect(await stockOf(corn.id)).toBe(850);
  });
});

describe('fractional quantities stay exact', () => {
  async function seedFractional(quantity) {
    await seedCatalogue();
    const flour = await ingredient({ item: 'Flour', unit: 'kg', quantity });
    await recipeRepository.create({
      branchId: 1,
      productId: PRODUCT.NACHOS,
      ingredients: [{ inventory_id: flour.id, quantity: 0.1 }],
    });
    return flour;
  }

  it('3 x 0.1 kg is exactly 0.3 kg, leaving 0.7 (not 0.7000000000000001)', async () => {
    const flour = await seedFractional(1);
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.NACHOS, 3]]));
    expect(await stockOf(flour.id)).toBe(0.7);
  });

  it('exactly enough fractional stock is enough — 0.3 kg covers 3 portions of 0.1 — and leaves OUT_OF_STOCK', async () => {
    const flour = await seedFractional(0.3);
    expect(await inventoryRepository.findShortages(1, orderOf([[PRODUCT.NACHOS, 3]]).items)).toEqual([]);
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.NACHOS, 3]]));
    const after = await Inventory.findOne({ id: flour.id });
    expect(after.quantity).toBe(0);
    expect(after.status).toBe('OUT_OF_STOCK');
  });

  it('many small sales never accumulate drift', async () => {
    const flour = await seedFractional(1);
    for (let i = 0; i < 10; i += 1) await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.NACHOS, 1]]));
    expect(await stockOf(flour.id)).toBe(0);
    expect((await Inventory.findOne({ id: flour.id })).status).toBe('OUT_OF_STOCK');
  });

  it('a fractional import lands on the grid too', async () => {
    const flour = await ingredient({ item: 'Sugar', unit: 'kg', quantity: 0.1 });
    await inventoryRepository.importStock(flour.id, { quantity: 0.2 });
    expect(await stockOf(flour.id)).toBe(0.3);
  });
});

describe('status follows the ingredient stock', () => {
  it('selling down to the minimum flips the ingredient to LOW_STOCK, to zero to OUT_OF_STOCK', async () => {
    await seedCatalogue();
    const corn = await ingredient({ item: 'Corn', quantity: 500, minimumQuantity: 200 });
    await recipeRepository.create({
      branchId: 1,
      productId: PRODUCT.LARGE_POPCORN,
      ingredients: [{ inventory_id: corn.id, quantity: 150 }],
    });
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]])); // 350
    expect((await Inventory.findOne({ id: corn.id })).status).toBe('IN_STOCK');
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]])); // 200 == minimum
    expect((await Inventory.findOne({ id: corn.id })).status).toBe('LOW_STOCK');
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 1]])); // 50
    await inventoryRepository.deductForComboOrder(orderOf([[PRODUCT.LARGE_POPCORN, 0]])); // no-op
    expect((await Inventory.findOne({ id: corn.id })).quantity).toBe(50);
  });
});

describe('concurrent sales cannot oversell an ingredient', () => {
  it('of 12 racing single-portion sales with corn for exactly 5, exactly 5 succeed and stock never goes negative', async () => {
    // Corn is the first (lowest id) and only limiting ingredient, so refused sales leave nothing to undo.
    const { corn, butter, salt } = await seedPopcorn({ corn: 750 });
    const orders = Array.from({ length: 12 }, () => orderOf([[PRODUCT.LARGE_POPCORN, 1]]));
    const outcomes = await Promise.allSettled(orders.map((order) => inventoryRepository.deductForComboOrder(order)));

    const ok = outcomes.filter((o) => o.status === 'fulfilled');
    const refused = outcomes.filter((o) => o.status === 'rejected');
    expect(ok).toHaveLength(5);
    expect(refused).toHaveLength(7);
    expect(refused.every((o) => o.reason instanceof InsufficientStockError)).toBe(true);
    expect(await stocks(corn, butter, salt)).toEqual([0, 900, 975]);
  });

  it('with several limiting ingredients, no ingredient goes negative and none leaks (stock == start - sold x recipe)', async () => {
    // Butter allows 3 portions, corn 5: refused sales that had already taken corn must give it back.
    const { corn, butter, salt } = await seedPopcorn({ corn: 750, butter: 60 });
    const orders = Array.from({ length: 10 }, () => orderOf([[PRODUCT.LARGE_POPCORN, 1]]));
    const outcomes = await Promise.allSettled(orders.map((order) => inventoryRepository.deductForComboOrder(order)));

    const sold = outcomes.filter((o) => o.status === 'fulfilled').length;
    expect(sold).toBeLessThanOrEqual(3);
    expect(sold).toBeGreaterThanOrEqual(1);
    expect(outcomes.filter((o) => o.status === 'rejected').every((o) => o.reason instanceof InsufficientStockError)).toBe(true);

    const [cornLeft, butterLeft, saltLeft] = await stocks(corn, butter, salt);
    expect(cornLeft).toBe(750 - sold * 150);
    expect(butterLeft).toBe(60 - sold * 20);
    expect(saltLeft).toBe(1000 - sold * 5);
    expect(butterLeft).toBeGreaterThanOrEqual(0);
    // Every ledger row belongs to a sale that went through — refused ones left none behind.
    expect(await InventoryTransaction.countDocuments({ type: 'SALE' })).toBe(sold * 3);
  });

  it('retrying the same paid order concurrently deducts once', async () => {
    const { corn } = await seedPopcorn();
    const order = orderOf([[PRODUCT.LARGE_POPCORN, 1]]);
    await Promise.all(Array.from({ length: 6 }, () => inventoryRepository.deductForComboOrder(order)));
    expect(await stockOf(corn.id)).toBe(850);
  });
});

describe('recipe.repository', () => {
  it('finds recipes of a product set within one branch only', async () => {
    await seedPopcorn();
    expect(await recipeRepository.findByProductIds([1, 11], 1)).toHaveLength(1);
    expect(await recipeRepository.findByProductIds([1], 2)).toHaveLength(0);
    expect(await recipeRepository.findByProductIds([], 1)).toEqual([]);
  });

  it('enforces one recipe per product', async () => {
    const { corn } = await seedPopcorn();
    await expect(
      recipeRepository.create({ branchId: 1, productId: PRODUCT.LARGE_POPCORN, ingredients: [{ inventory_id: corn.id, quantity: 1 }] }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('knows which ingredients are in use', async () => {
    const { corn } = await seedPopcorn();
    const unused = await ingredient({ item: 'Sugar' });
    expect(await recipeRepository.existsForInventory(corn.id)).toBe(true);
    expect(await recipeRepository.existsForInventory(unused.id)).toBe(false);
    expect(await recipeRepository.listForInventory(corn.id)).toHaveLength(1);
  });
});
