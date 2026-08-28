const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');
const { KEYS } = require('../config/settingsRegistry');

const systemConfigSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    key: { type: String, enum: KEYS, required: true, index: true },
    branch_id: { type: Number, default: null, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updated_by: { type: Number, default: null },
  },
  { timestamps: true },
);

systemConfigSchema.index({ key: 1, branch_id: 1 }, { unique: true });

withCleanJSON(systemConfigSchema);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
