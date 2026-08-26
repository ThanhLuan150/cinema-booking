const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const inventorySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    // Optional link to a FOOD/BEVERAGE Combo item — when set, a paid ComboOrder line for that
    // combo_id (or a COMBO bundle containing it) auto-deducts this record. Untracked items
    // (combo_id: null) are warehouse-only stock (e.g. raw ingredients) with no auto-deduction.
    combo_id: { type: Number, default: null, index: true },
    item: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    minimum_quantity: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true, default: 'unit' },
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

withCleanJSON(inventorySchema);

const Inventory = mongoose.model('Inventory', inventorySchema);
Inventory.STATUS = { IN_STOCK: 'IN_STOCK', LOW_STOCK: 'LOW_STOCK', OUT_OF_STOCK: 'OUT_OF_STOCK' };
Inventory.computeStatus = function computeStatus(quantity, minimumQuantity) {
  if (quantity <= 0) return Inventory.STATUS.OUT_OF_STOCK;
  if (quantity <= minimumQuantity) return Inventory.STATUS.LOW_STOCK;
  return Inventory.STATUS.IN_STOCK;
};

module.exports = Inventory;
