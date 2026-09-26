require('dotenv').config();

const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');

// Ticket 45 migration for an existing database. The stock ledger used RECEIVE / ADJUST / DEDUCT;
// it now uses IMPORT / SALE / RETURN / ADJUSTMENT / WASTE. Rewrites the old rows in place:
//   RECEIVE                       -> IMPORT
//   ADJUST                        -> ADJUSTMENT
//   DEDUCT (ref_type COMBO_ORDER) -> SALE   (the automatic combo-sale deduction)
//   DEDUCT (anything else)        -> WASTE  (a manual write-off)
// Idempotent — a second run finds nothing left to rewrite.
//
// It also REPORTS (never edits) Inventory records that track the same Combo item twice in one
// branch: the new unique (branch_id, combo_id) index cannot build over those, and which record a
// sale should deduct from is a human decision. Unlink one with PUT /api/inventory/:id { combo_id: null }.
async function migrate() {
  const { TYPE, REF, LEGACY_TYPE_MAP } = InventoryTransaction;
  const rewritten = {};

  for (const [from, to] of Object.entries(LEGACY_TYPE_MAP)) {
    const result = await InventoryTransaction.updateMany({ type: from }, { $set: { type: to } });
    rewritten[`${from}->${to}`] = result.modifiedCount;
  }
  const sales = await InventoryTransaction.updateMany(
    { type: 'DEDUCT', ref_type: REF.SALE },
    { $set: { type: TYPE.SALE } },
  );
  rewritten['DEDUCT->SALE'] = sales.modifiedCount;
  const waste = await InventoryTransaction.updateMany({ type: 'DEDUCT' }, { $set: { type: TYPE.WASTE } });
  rewritten['DEDUCT->WASTE'] = waste.modifiedCount;

  const duplicateLinks = await Inventory.aggregate([
    { $match: { combo_id: { $type: 'number' } } },
    { $group: { _id: { branch_id: '$branch_id', combo_id: '$combo_id' }, ids: { $push: '$id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  return {
    rewritten,
    duplicateLinks: duplicateLinks.map((d) => ({ branch_id: d._id.branch_id, combo_id: d._id.combo_id, inventory_ids: d.ids })),
  };
}

async function run() {
  const connectDB = require('../config/db');
  await connectDB();

  const { rewritten, duplicateLinks } = await migrate();
  for (const [change, count] of Object.entries(rewritten)) console.log(`${change}: ${count} row(s)`);
  if (duplicateLinks.length === 0) console.log('No duplicate combo links.');
  for (const d of duplicateLinks) {
    console.warn(
      `Branch ${d.branch_id} tracks combo ${d.combo_id} in records ${d.inventory_ids.join(', ')} — unlink all but one.`,
    );
  }

  // Build the new unique indexes now that duplicates (if any) have been reported.
  await Inventory.syncIndexes();
  await InventoryTransaction.syncIndexes();
  process.exit(0);
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
