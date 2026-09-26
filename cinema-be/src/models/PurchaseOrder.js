const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const lineSchema = new mongoose.Schema(
  {
    inventory_id: { type: Number, required: true },
    item: { type: String, required: true },
    sku: { type: String, default: null },
    unit: { type: String, default: 'unit' },
    quantity: { type: Number, required: true, min: 0 },
    unit_cost: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    supplier_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    order_date: { type: Date, required: true },
    expected_date: { type: Date, default: null },
    status: {
      type: String,
      enum: ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    // Always derived from the lines on the server — never taken from a client.
    total_amount: { type: Number, required: true, default: 0, min: 0 },
    items: { type: [lineSchema], default: [] },
    note: { type: String, default: '' },
    created_by: { type: Number, default: null },
    ordered_by: { type: Number, default: null },
    ordered_at: { type: Date, default: null },
    received_by: { type: Number, default: null },
    received_at: { type: Date, default: null },
    cancelled_by: { type: Number, default: null },
    cancelled_at: { type: Date, default: null },
    cancel_reason: { type: String, default: '' },
  },
  { timestamps: true },
);

// "Open" orders (still able to become RECEIVED) are looked up by the product they contain when an
// Inventory record is about to be deleted.
purchaseOrderSchema.index({ 'items.inventory_id': 1, status: 1 });

withCleanJSON(purchaseOrderSchema);

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
PurchaseOrder.STATUS = { DRAFT: 'DRAFT', ORDERED: 'ORDERED', RECEIVED: 'RECEIVED', CANCELLED: 'CANCELLED' };
PurchaseOrder.OPEN_STATUSES = [PurchaseOrder.STATUS.DRAFT, PurchaseOrder.STATUS.ORDERED];
PurchaseOrder.codeFor = (id) => `PO-${String(id).padStart(6, '0')}`;

module.exports = PurchaseOrder;
