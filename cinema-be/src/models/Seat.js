const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// DISABLED seats are excluded from the bookable ticket grid (see ticket.controller).
const SEAT_STATUSES = ['ACTIVE', 'DISABLED'];

const seatSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    room_id: { type: Number, required: true, index: true },
    row: { type: String, default: '' }, // e.g. "A"
    number: { type: Number, default: 0 }, // e.g. 1
    seat_code: { type: String, required: true }, // e.g. "A1" (row + number)
    seat_type: { type: Number, default: 0 }, // 0 = regular, 1 = vip, 2 = couple
    status: { type: String, enum: SEAT_STATUSES, default: 'ACTIVE' },
  },
  { timestamps: true },
);

seatSchema.index({ room_id: 1, seat_code: 1 }, { unique: true });

withCleanJSON(seatSchema);

const Seat = mongoose.model('Seat', seatSchema);
Seat.STATUSES = SEAT_STATUSES;

module.exports = Seat;
