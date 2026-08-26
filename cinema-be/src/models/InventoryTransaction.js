const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// The "Lịch sử kho" audit trail: every receive/adjust/deduct against an Inventory record
// leaves one row here, so stock levels are always explainable after the fact.
const inventoryTransactionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    inventory_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    type: { type: String, enum: ['RECEIVE', 'ADJUST', 'DEDUCT'], required: true, index: true },
    quantity_change: { type: Number, required: true }, // signed delta actually applied
    quantity_before: { type: Number, required: true },
    quantity_after: { type: Number, required: true },
    reason: { type: String, default: '' },
    ref_type: { type: String, default: null }, // e.g. 'COMBO_ORDER' for automatic sale deductions
    ref_code: { type: String, default: null }, // e.g. `${comboOrder.code}:${comboId}`
    performed_by: { type: Number, default: null }, // account id; null for automatic deductions
  },
  { timestamps: true },
);

// Idempotency guard: a duplicate payment callback (or any retried caller) that tries to log the
// same (ref_type, ref_code) deduction twice hits this unique index instead of double-decrementing
// stock — inventory.repository.deductForComboOrder claims this row before touching quantity.
inventoryTransactionSchema.index(
  { ref_type: 1, ref_code: 1 },
  { unique: true, partialFilterExpression: { ref_code: { $type: 'string' } } },
);

withCleanJSON(inventoryTransactionSchema);

const InventoryTransaction = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
InventoryTransaction.TYPE = { RECEIVE: 'RECEIVE', ADJUST: 'ADJUST', DEDUCT: 'DEDUCT' };

module.exports = InventoryTransaction;
