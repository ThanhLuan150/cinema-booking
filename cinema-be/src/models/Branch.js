const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const branchSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    company_id: { type: Number, required: true, index: true },
    owner_id: { type: Number, required: true, index: true }, // assigned Branch Admin account id
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    images: { type: [String], default: [] },
    opening_time: { type: String, default: '' }, // HH:mm
    closing_time: { type: String, default: '' }, // HH:mm
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' },
  },
  { timestamps: true },
);

withCleanJSON(branchSchema);

module.exports = mongoose.model('Branch', branchSchema);
