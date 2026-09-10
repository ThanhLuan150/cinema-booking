const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A parking zone that belongs to one Branch (e.g. "Basement B1", "Rooftop lot"). It groups
// ParkingSlots. `capacity` is the operator-declared number of vehicles the zone can hold and
// is informational — the authoritative count of usable spaces is the number of ParkingSlots
// under it. A zone that is INACTIVE or under MAINTENANCE has none of its slots handed out to
// arriving vehicles (see parking.repository.findAssignableSlot).
const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

const parkingAreaSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
  },
  { timestamps: true },
);

withCleanJSON(parkingAreaSchema);

const ParkingArea = mongoose.model('ParkingArea', parkingAreaSchema);
ParkingArea.STATUSES = STATUSES;

module.exports = ParkingArea;
