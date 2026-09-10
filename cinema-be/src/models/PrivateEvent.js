const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Ticket 40 — a customer's (or a business's) request to rent a cinema room for a Private Event.
// Lifecycle (see privateEvent.controller):
//   REQUESTED  -> customer submitted; no branch admin has looked at it yet
//   QUOTED     -> branch admin reviewed it and set `quoted_amount`
//   APPROVED   -> branch admin accepted the quote path; the customer may now pay
//   PAID       -> customer settled `quoted_amount` (simulated terminal, like the kiosk flow)
//   CONFIRMED  -> branch admin confirmed the paid booking; the room slot is committed
//   COMPLETED  -> the event has taken place
//   CANCELLED  -> dropped by the customer (before CONFIRMED) or rejected/cancelled by the admin
//
// Business rules enforced around this model (privateEvent.controller + utils/eventWindow):
//   - the [start_at, end_at) window must not overlap any ACTIVE Schedule (showtime) in the room
//   - it must not overlap another non-CANCELLED PrivateEvent in the same room
//   - the Room must be ACTIVE ("AVAILABLE")
//   - a branch admin only sees / acts on events of a branch they own; SUPER_ADMIN sees all
const STATUS = {
  REQUESTED: 'REQUESTED',
  QUOTED: 'QUOTED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
};

const STATUSES = Object.values(STATUS);

// Statuses that still hold the room slot and therefore block a competing showtime / event.
// Everything except CANCELLED — a CANCELLED request has released its slot.
const BLOCKING_STATUSES = STATUSES.filter((s) => s !== STATUS.CANCELLED);

const privateEventSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    customer_id: { type: Number, required: true, index: true }, // Account.id of the requester
    branch_id: { type: Number, required: true, index: true },
    room_id: { type: Number, required: true, index: true },
    package_id: { type: Number, required: true, index: true },

    start_at: { type: Date, required: true, index: true },
    end_at: { type: Date, required: true, index: true },
    guest_count: { type: Number, required: true, min: 1 },

    status: { type: String, enum: STATUSES, default: STATUS.REQUESTED, index: true },

    // Customer-supplied request details.
    title: { type: String, default: '', trim: true },
    contact_name: { type: String, default: '', trim: true },
    contact_phone: { type: String, default: '', trim: true },
    contact_email: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },

    // Set by the branch admin on QUOTED.
    quoted_amount: { type: Number, default: null, min: 0 },
    quote_notes: { type: String, default: '', trim: true },
    reviewed_by: { type: Number, default: null }, // admin Account.id
    reviewed_at: { type: Date, default: null },

    approved_at: { type: Date, default: null },
    paid_at: { type: Date, default: null },
    confirmed_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    cancel_reason: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

withCleanJSON(privateEventSchema);

const PrivateEvent = mongoose.model('PrivateEvent', privateEventSchema);
PrivateEvent.STATUS = STATUS;
PrivateEvent.STATUSES = STATUSES;
PrivateEvent.BLOCKING_STATUSES = BLOCKING_STATUSES;

module.exports = PrivateEvent;
