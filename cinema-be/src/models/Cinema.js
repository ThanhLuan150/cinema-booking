const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const cinemaSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    owner_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    images: { type: [String], default: [] },
    status: { type: Number, default: 0 }, // 0 = pending, 1 = approved, 2 = blocked
  },
  { timestamps: true },
);

withCleanJSON(cinemaSchema);

module.exports = mongoose.model('Cinema', cinemaSchema);
