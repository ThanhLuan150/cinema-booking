const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// One vehicle's parking session at a Branch, created when the vehicle enters and closed when
// it has left and paid. Lifecycle (see parking.controller):
//   ACTIVE          - vehicle is parked; exactly one ParkingSlot is OCCUPIED by this ticket
//   PENDING_PAYMENT - vehicle has left, `exit_at` and `fee` are set, slot not yet released
//   COMPLETED       - fee paid, slot released back to AVAILABLE
//   CANCELLED       - session voided before payment (mistake / vehicle never really parked);
//                     slot released, fee forced to 0
// `branch_id` is denormalised so every branch-scope check and list filter works without a
// join through slot -> area. `ticket_code` is the human-facing reference printed on the stub.
const STATUSES = ['ACTIVE', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED'];

const parkingTicketSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    ticket_code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    slot_id: { type: Number, required: true, index: true },
    vehicle_type: { type: String, required: true },
    vehicle_plate: { type: String, required: true, uppercase: true, trim: true, index: true },
    entry_at: { type: Date, required: true, default: Date.now },
    exit_at: { type: Date, default: null },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
    fee: { type: Number, default: 0, min: 0 },
    paid_at: { type: Date, default: null },
  },
  { timestamps: true },
);

withCleanJSON(parkingTicketSchema);

const ParkingTicket = mongoose.model('ParkingTicket', parkingTicketSchema);
ParkingTicket.STATUSES = STATUSES;

module.exports = ParkingTicket;
