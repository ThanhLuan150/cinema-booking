const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const CATEGORIES = ['THEFT', 'DISTURBANCE', 'MEDICAL', 'FIRE_SAFETY', 'SUSPICIOUS', 'OTHER'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];

// A floor incident reported by branch staff (chiefly SECURITY). Append-only from the API: it can
// be filed and read, not edited — a follow-up is a new report.
const incidentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    room_id: { type: Number, default: null }, // where it happened, when it happened inside a room
    category: { type: String, enum: CATEGORIES, required: true },
    severity: { type: String, enum: SEVERITIES, default: 'LOW' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    reported_by: { type: Number, required: true }, // Account id of the reporter
  },
  { timestamps: true },
);

withCleanJSON(incidentSchema);

const Incident = mongoose.model('Incident', incidentSchema);
Incident.CATEGORIES = CATEGORIES;
Incident.SEVERITIES = SEVERITIES;

module.exports = Incident;
