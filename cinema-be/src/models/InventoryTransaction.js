const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// The "Lịch sử kho" audit trail: every movement against an Inventory record leaves one row here,
// so stock levels are always explainable after the fact.
//   IMPORT      stock received from a supplier (+)
//   SALE        automatic deduction when a Combo is sold (-)
//   RETURN      stock put back — a cancelled sale, or goods returned by hand (+)
//   ADJUSTMENT  stocktake correction to an absolute counted quantity (+/-)
//   WASTE       spoiled / expired / damaged stock written off (-)
const inventoryTransactionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    inventory_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    type: { type: String, enum: ['IMPORT', 'SALE', 'RETURN', 'ADJUSTMENT', 'WASTE'], required: true, index: true },
    quantity_change: { type: Number, required: true }, // signed delta actually applied
    quantity_before: { type: Number, required: true },
    quantity_after: { type: Number, required: true },
    reason: { type: String, default: '' },
    ref_type: { type: String, default: null }, // 'COMBO_ORDER' (sale) / 'COMBO_ORDER_RETURN' (its restock)
    ref_code: { type: String, default: null }, // `${comboOrder.code}:${comboId}`
    performed_by: { type: Number, default: null }, // account id; null for automatic movements
  },
  { timestamps: true },
);

// Idempotency guard: a duplicate payment callback (or any retried caller) that tries to log the
// same (ref_type, ref_code) movement twice hits this unique index instead of moving stock twice —
// inventory.repository claims this row before touching quantity.
inventoryTransactionSchema.index(
  { ref_type: 1, ref_code: 1 },
  { unique: true, partialFilterExpression: { ref_code: { $type: 'string' } } },
);

withCleanJSON(inventoryTransactionSchema);

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
InventoryTransaction.TYPE = {
  IMPORT: 'IMPORT',
  SALE: 'SALE',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  WASTE: 'WASTE',
};
InventoryTransaction.REF = { SALE: 'COMBO_ORDER', RETURN: 'COMBO_ORDER_RETURN' };
// Pre-Ticket-45 rows used these names; seed/migrateInventoryMovements.js rewrites them in place.
InventoryTransaction.LEGACY_TYPE_MAP = { RECEIVE: 'IMPORT', ADJUST: 'ADJUSTMENT' };

module.exports = InventoryTransaction;
