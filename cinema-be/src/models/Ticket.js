const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const ticketSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    schedule_id: { type: Number, required: true, index: true },
    seat_index: { type: Number, required: true }, // 0-39, row/col order: A1..A8,B1..B8,...E1..E8
    seat_code: { type: String, required: true }, // e.g. "A1"
    seat_type: { type: Number, default: 0 }, // 0 = regular, 1 = vip, 2 = couple (snapshotted from Seat)
    status: { type: Number, default: 1 }, // 1 = available, 0 = booked/sold
  },
  { timestamps: true },
);

withCleanJSON(ticketSchema);

module.exports = mongoose.model('Ticket', ticketSchema);
