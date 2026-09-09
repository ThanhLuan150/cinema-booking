const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const distributorSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    contact_email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(distributorSchema);

module.exports = mongoose.model('Distributor', distributorSchema);
