const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Ticket 40 — a rental package a customer picks when booking a room for a Private Event
// ("Basic hall hire", "Premium with catering", ...). Company-wide catalogue (no branch_id):
// SUPER_ADMIN maintains it, every branch offers the same set. `base_price` is the sticker
// price shown in the request wizard; what a customer actually pays is the `quoted_amount` a
// branch admin sets on the PrivateEvent after review. `max_guests` of 0 means "no cap";
// INACTIVE packages are hidden from the wizard and rejected on request.
const STATUSES = ['ACTIVE', 'INACTIVE'];

const eventPackageSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    base_price: { type: Number, required: true, min: 0, default: 0 },
    max_guests: { type: Number, min: 0, default: 0 },
    duration_hours: { type: Number, min: 0, default: 0 },
    perks: { type: [String], default: [] },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(eventPackageSchema);

const EventPackage = mongoose.model('EventPackage', eventPackageSchema);
EventPackage.STATUSES = STATUSES;

module.exports = EventPackage;
