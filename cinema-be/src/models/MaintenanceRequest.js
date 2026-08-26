const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// What can be put under maintenance. ROOM and SEAT reference an existing Room/Seat document
// (room_id / seat_id); the rest have no backing model in this system, so they're identified by
// a free-text resource_name, optionally located inside a Room via room_id.
const RESOURCE_TYPES = [
  'ROOM',
  'PROJECTOR',
  'SOUND_SYSTEM',
  'AIR_CONDITIONER',
  'SEAT',
  'QR_SCANNER',
  'POS',
  'EQUIPMENT_OTHER',
];

const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const maintenanceRequestSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    resource_type: { type: String, enum: RESOURCE_TYPES, required: true },
    room_id: { type: Number, default: null, index: true }, // the Room this resource is/lives in
    seat_id: { type: Number, default: null }, // set only when resource_type === 'SEAT'
    resource_name: { type: String, default: '' }, // free-text label; required when resource_type has no backing model
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: STATUSES, default: 'OPEN', index: true },
    reported_by: { type: Number, required: true }, // Account id of whoever detected/reported the issue
    assigned_employee_id: { type: Number, default: null },
    assigned_by: { type: Number, default: null },
    assigned_at: { type: Date, default: null },
    started_at: { type: Date, default: null },
    resolved_at: { type: Date, default: null },
    resolution_note: { type: String, default: null },
    closed_at: { type: Date, default: null },
    closed_by: { type: Number, default: null },
  },
  { timestamps: true },
);

withCleanJSON(maintenanceRequestSchema);

const MaintenanceRequest = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
MaintenanceRequest.RESOURCE_TYPES = RESOURCE_TYPES;
MaintenanceRequest.STATUSES = STATUSES;
// Statuses that still count as "the resource is under an open maintenance issue" — used to
// decide whether a ROOM can be taken back out of MAINTENANCE (see maintenanceRequest.controller).
MaintenanceRequest.ACTIVE_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS'];

module.exports = MaintenanceRequest;
