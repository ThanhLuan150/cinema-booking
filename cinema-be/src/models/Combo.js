const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const comboSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    cinema_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    image: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

withCleanJSON(comboSchema);

module.exports = mongoose.model('Combo', comboSchema);
