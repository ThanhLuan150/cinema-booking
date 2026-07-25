const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const seatSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    room_id: { type: Number, required: true, index: true },
    seat_code: { type: String, required: true }, // e.g. "A1"
    seat_type: { type: Number, default: 0 }, // 0 = regular, 1 = vip, 2 = couple
    is_locked: { type: Boolean, default: false }, // maintenance lock
  },
  { timestamps: true },
);

seatSchema.index({ room_id: 1, seat_code: 1 }, { unique: true });

withCleanJSON(seatSchema);

module.exports = mongoose.model('Seat', seatSchema);
