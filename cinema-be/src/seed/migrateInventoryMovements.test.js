const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const migrate = require('./migrateInventoryMovements');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

// Legacy rows are written straight to the collection: the model's enum (rightly) refuses them now.
async function insertLegacy(rows) {
  await InventoryTransaction.collection.insertMany(
    rows.map((row, i) => ({
      id: i + 1,
      inventory_id: 1,
      branch_id: 1,
      quantity_change: 1,
      quantity_before: 0,
      quantity_after: 1,
      reason: '',
      ref_type: null,
      ref_code: null,
      performed_by: null,
      ...row,
    })),
  );
}

const typesById = async () =>
  Object.fromEntries((await InventoryTransaction.find().sort({ id: 1 })).map((t) => [t.id, t.type]));

describe('migrateInventoryMovements', () => {
  it('renames RECEIVE/ADJUST, and splits DEDUCT into SALE (combo order) vs WASTE (manual)', async () => {
    await insertLegacy([
      { type: 'RECEIVE' },
      { type: 'ADJUST' },
      { type: 'DEDUCT', ref_type: 'COMBO_ORDER', ref_code: 'CO-1:1' },
      { type: 'DEDUCT', reason: 'spoiled' },
      { type: 'IMPORT' }, // already migrated: left alone
    ]);

    const { rewritten } = await migrate();

    expect(await typesById()).toEqual({ 1: 'IMPORT', 2: 'ADJUSTMENT', 3: 'SALE', 4: 'WASTE', 5: 'IMPORT' });
    expect(rewritten).toEqual({
      'RECEIVE->IMPORT': 1,
      'ADJUST->ADJUSTMENT': 1,
      'DEDUCT->SALE': 1,
      'DEDUCT->WASTE': 1,
    });
  });

  it('is idempotent: a second run changes nothing', async () => {
    await insertLegacy([{ type: 'RECEIVE' }, { type: 'DEDUCT', ref_type: 'COMBO_ORDER', ref_code: 'CO-1:1' }]);
    await migrate();
    const { rewritten } = await migrate();
    expect(Object.values(rewritten).every((count) => count === 0)).toBe(true);
    expect(await typesById()).toEqual({ 1: 'IMPORT', 2: 'SALE' });
  });

  it('reports (without editing) a branch that tracks the same combo in two records', async () => {
    // A legacy database predates the unique (branch_id, combo_id) index, so it can hold duplicates.
    await Inventory.collection.dropIndex('branch_id_1_combo_id_1');
    await Inventory.collection.insertMany([
      { id: 1, branch_id: 1, combo_id: 5, item: 'A', quantity: 1, minimum_quantity: 0, unit: 'u', status: 'IN_STOCK' },
      { id: 2, branch_id: 1, combo_id: 5, item: 'B', quantity: 1, minimum_quantity: 0, unit: 'u', status: 'IN_STOCK' },
      { id: 3, branch_id: 2, combo_id: 5, item: 'A', quantity: 1, minimum_quantity: 0, unit: 'u', status: 'IN_STOCK' },
    ]);

    const { duplicateLinks } = await migrate();

    expect(duplicateLinks).toEqual([{ branch_id: 1, combo_id: 5, inventory_ids: [1, 2] }]);
    expect(await Inventory.countDocuments()).toBe(3);

    await Inventory.collection.deleteMany({});
    await Inventory.syncIndexes(); // put the index back for the rest of the suite
  });
});
