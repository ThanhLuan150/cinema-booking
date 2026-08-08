const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const positionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true }, // e.g. 'TICKET_STAFF' — not a mongoose enum,
    name: { type: String, required: true },
    status: { type: Number, default: 1 }, // 1 = active, 0 = inactive
  },
  { timestamps: true },
);

withCleanJSON(positionSchema);

module.exports = mongoose.model('Position', positionSchema);
