const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A physical way into a Branch (e.g. "Main lobby", "Gate B"). One Branch has many Entrances;
// a QR scanner Device is optionally pinned to one Entrance so check-in logs record where a
// ticket was scanned.
const STATUSES = ['ACTIVE', 'INACTIVE'];

const entranceSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, default: '' }, // short label, unique within its branch
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(entranceSchema);

const Entrance = mongoose.model('Entrance', entranceSchema);
Entrance.STATUSES = STATUSES;

module.exports = Entrance;
