const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Ticket 45 — the per-branch F&B "Product". Storage names predate the ticket and are kept so no
// existing data or client had to move: item = name, quantity = stock_quantity, minimum_quantity =
// minimum_stock. sku/category/cost_price/selling_price are the catalogue fields the ticket added.
const inventorySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    // Optional link to a FOOD/BEVERAGE Combo item — when set, a sale of that combo_id (or of a
    // COMBO bundle containing it) is checked against and deducted from this record. Untracked
    // items (combo_id: null) are warehouse-only stock (e.g. raw ingredients): never sale-blocked.
    combo_id: { type: Number, default: null, index: true },
    item: { type: String, required: true },
    sku: { type: String, default: null },
    category: { type: String, default: '' },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    minimum_quantity: { type: Number, required: true, default: 0, min: 0 },
    unit: { type: String, required: true, default: 'unit' },
    cost_price: { type: Number, default: 0, min: 0 },
    selling_price: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'],
      default: 'IN_STOCK',
      index: true,
    },
  },
  { timestamps: true },
);

// One inventory record per branch per named item.
inventorySchema.index({ branch_id: 1, item: 1 }, { unique: true });
// A SKU identifies one product within a branch. Partial, so any number of rows may have no SKU.
inventorySchema.index(
  { branch_id: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string' } } },
);
// A Combo item is tracked by at most one record per branch — otherwise "the" record a sale
// deducts from would be ambiguous.
inventorySchema.index(
  { branch_id: 1, combo_id: 1 },
  { unique: true, partialFilterExpression: { combo_id: { $type: 'number' } } },
);

withCleanJSON(inventorySchema);

const Inventory = mongoose.model('Inventory', inventorySchema);
Inventory.STATUS = { IN_STOCK: 'IN_STOCK', LOW_STOCK: 'LOW_STOCK', OUT_OF_STOCK: 'OUT_OF_STOCK' };
Inventory.computeStatus = function computeStatus(quantity, minimumQuantity) {
  if (quantity <= 0) return Inventory.STATUS.OUT_OF_STOCK;
  if (quantity <= minimumQuantity) return Inventory.STATUS.LOW_STOCK;
  return Inventory.STATUS.IN_STOCK;
};
// The same rule as computeStatus, as an aggregation expression. Atomic stock updates are
// pipeline updates that set `quantity` and then `status` in one server-side operation, so a
// concurrent writer can never observe (or leave behind) a status that disagrees with quantity.
Inventory.STATUS_EXPR = {
  $switch: {
    branches: [
      { case: { $lte: ['$quantity', 0] }, then: Inventory.STATUS.OUT_OF_STOCK },
      { case: { $lte: ['$quantity', '$minimum_quantity'] }, then: Inventory.STATUS.LOW_STOCK },
    ],
    default: Inventory.STATUS.IN_STOCK,
  },
};
Inventory.isLow = (status) => status === Inventory.STATUS.LOW_STOCK || status === Inventory.STATUS.OUT_OF_STOCK;

module.exports = Inventory;
