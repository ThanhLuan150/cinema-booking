const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Screen format. VIP here means a premium auditorium (reclining seats, smaller capacity),
// distinct from Seat.seat_type's per-seat VIP designation.
const ROOM_TYPES = ['2D', '3D', 'IMAX', 'VIP'];
// MAINTENANCE/CLOSED rooms may not receive new Showtimes (enforced in schedule.controller).
const ROOM_STATUSES = ['ACTIVE', 'MAINTENANCE', 'CLOSED'];

const roomSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    cinema_id: { type: Number, required: true, index: true }, // the owning Branch
    name: { type: String, required: true },
    code: { type: String, default: '' }, // short room code, unique within its branch
    type: { type: String, enum: ROOM_TYPES, default: '2D' },
    capacity: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ROOM_STATUSES, default: 'ACTIVE' },
  },
  { timestamps: true },
);

withCleanJSON(roomSchema);

const Room = mongoose.model('Room', roomSchema);
Room.TYPES = ROOM_TYPES;
Room.STATUSES = ROOM_STATUSES;

module.exports = Room;
