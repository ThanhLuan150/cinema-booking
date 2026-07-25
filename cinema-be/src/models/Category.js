const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const categorySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
  },
  { timestamps: true },
);

withCleanJSON(categorySchema);

module.exports = mongoose.model('Category', categorySchema);
