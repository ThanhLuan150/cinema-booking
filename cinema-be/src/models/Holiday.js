const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A single calendar date treated as a holiday for pricing purposes (see
const holidaySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    name: { type: String, default: '' },
    branch_id: { type: Number, default: null, index: true },
  },
  { timestamps: true },
);

holidaySchema.index({ date: 1, branch_id: 1 }, { unique: true });

withCleanJSON(holidaySchema);

module.exports = mongoose.model('Holiday', holidaySchema);
