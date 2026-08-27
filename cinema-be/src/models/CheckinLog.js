const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// One row per check-in attempt at a door. Written by the device-authenticated scan endpoint
// (device_id set) and by the staff-operated check-in path (device_id null). `result` records
// whether the ticket was actually admitted, so a rejected scan (wrong branch, already used,
// outside the window) is still auditable.
const RESULTS = ['SUCCESS', 'REJECTED'];

const checkinLogSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    device_id: { type: Number, default: null, index: true }, // Device.id, null for a staff check-in
    entrance_id: { type: Number, default: null, index: true },
    branch_id: { type: Number, required: true, index: true },
    invoice_id: { type: Number, default: null, index: true },
    qr_token: { type: String, default: null },
    checked_in_by: { type: Number, default: null }, // Account.id of the staff member, null for an autonomous device
    checked_in_at: { type: Date, default: Date.now },
    result: { type: String, enum: RESULTS, required: true },
    reason: { type: String, default: null }, // failure code when result === 'REJECTED'
  },
  { timestamps: true },
);

withCleanJSON(checkinLogSchema);

const CheckinLog = mongoose.model('CheckinLog', checkinLogSchema);
CheckinLog.RESULTS = RESULTS;

module.exports = CheckinLog;
