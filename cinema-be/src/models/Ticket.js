const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const ticketSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    schedule_id: { type: Number, required: true, index: true },
    seat_index: { type: Number, required: true }, // 0-39, row/col order: A1..A8,B1..B8,...E1..E8
    seat_code: { type: String, required: true }, // e.g. "A1"
    seat_type: { type: Number, default: 0 }, // 0 = regular, 1 = vip, 2 = couple (snapshotted from Seat)
    status: { type: Number, default: 1 }, // 0 = booked/sold, 1 = available, 2 = held
    held_by: { type: Number, default: null }, // accountId currently holding this seat, while status === HELD
    held_until: { type: Date, default: null }, // hold expiry; bookseat/hold sweep expired holds back to AVAILABLE
  },
  { timestamps: true },
);

withCleanJSON(ticketSchema);

const Ticket = mongoose.model('Ticket', ticketSchema);
Ticket.STATUS = { BOOKED: 0, AVAILABLE: 1, HELD: 2 };

module.exports = Ticket;
