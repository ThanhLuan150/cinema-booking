const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const supplierSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(supplierSchema);

const Supplier = mongoose.model('Supplier', supplierSchema);
Supplier.STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

module.exports = Supplier;
