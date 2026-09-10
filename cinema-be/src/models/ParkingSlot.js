const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A single numbered space inside a ParkingArea. `slot_code` is the painted label ("B1-042")
// and is unique within its area. `status` is the live occupancy state:
//   AVAILABLE   - free, may be assigned to an arriving vehicle
//   OCCUPIED    - a vehicle is parked here (there is an ACTIVE ParkingTicket pointing at it)
//   RESERVED    - held out of general rotation (season ticket, staff, EV charger, ...)
//   MAINTENANCE - out of service
// Only AVAILABLE -> OCCUPIED is performed by the vehicle-entry flow, and it is done with a
// single atomic conditional update so one slot can never be handed to two vehicles at once
// (see parking.repository.claimSlot).
const STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];
const VEHICLE_TYPES = ['CAR', 'MOTORBIKE', 'BICYCLE', 'OTHER'];

const parkingSlotSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    parking_area_id: { type: Number, required: true, index: true },
    slot_code: { type: String, required: true, trim: true },
    vehicle_type: { type: String, enum: VEHICLE_TYPES, default: 'CAR', index: true },
    status: { type: String, enum: STATUSES, default: 'AVAILABLE', index: true },
  },
  { timestamps: true },
);

// slot_code is unique within its area, not globally.
parkingSlotSchema.index({ parking_area_id: 1, slot_code: 1 }, { unique: true });

withCleanJSON(parkingSlotSchema);

const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema);
ParkingSlot.STATUSES = STATUSES;
ParkingSlot.VEHICLE_TYPES = VEHICLE_TYPES;

module.exports = ParkingSlot;
