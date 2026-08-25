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
    type: { type: String, enum: ['FOOD', 'BEVERAGE', 'COMBO'], default: 'COMBO', index: true },
    items: {
      type: [
        {
          _id: false,
          item_id: { type: Number, required: true }, // another Combo's id (must be FOOD or BEVERAGE)
          quantity: { type: Number, required: true, default: 1 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

withCleanJSON(comboSchema);

const Combo = mongoose.model('Combo', comboSchema);
Combo.TYPE = { FOOD: 'FOOD', BEVERAGE: 'BEVERAGE', COMBO: 'COMBO' };

module.exports = Combo;
