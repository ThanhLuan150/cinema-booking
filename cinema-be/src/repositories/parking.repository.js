const ParkingArea = require('../models/ParkingArea');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingTicket = require('../models/ParkingTicket');

// ---- Parking areas --------------------------------------------------------

async function findAreas(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    ParkingArea.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    ParkingArea.countDocuments(filter),
  ]);
  return { data, total };
}

async function findAreaById(id) {
  return ParkingArea.findOne({ id: Number(id) });
}

async function findBranchIdByAreaId(id) {
  const area = await ParkingArea.findOne({ id: Number(id) });
  return area ? area.branch_id : null;
}

async function createArea(data) {
  return ParkingArea.create(data);
}

async function updateArea(id, updates) {
  return ParkingArea.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function removeArea(id) {
  return ParkingArea.deleteOne({ id: Number(id) });
}

async function countSlotsForArea(areaId) {
  return ParkingSlot.countDocuments({ parking_area_id: Number(areaId) });
}

// ---- Parking slots ------------------------------------------------------

async function findSlots(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    ParkingSlot.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    ParkingSlot.countDocuments(filter),
  ]);
  return { data, total };
}

async function findSlotById(id) {
  return ParkingSlot.findOne({ id: Number(id) });
}

async function findSlotByAreaAndCode(areaId, slotCode, { excludeId } = {}) {
  const filter = { parking_area_id: Number(areaId), slot_code: slotCode };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return ParkingSlot.findOne(filter);
}

// branch_id lives on the slot's area, not the slot.
async function findBranchIdBySlotId(id) {
  const slot = await ParkingSlot.findOne({ id: Number(id) });
  if (!slot) return null;
  return findBranchIdByAreaId(slot.parking_area_id);
}

async function createSlot(data) {
  return ParkingSlot.create(data);
}

async function updateSlot(id, updates) {
  return ParkingSlot.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function removeSlot(id) {
  return ParkingSlot.deleteOne({ id: Number(id) });
}

// ---- Slot assignment (the concurrency-critical operations) -----------------

// Atomically claim a specific slot for an arriving vehicle. The status guard is inside the
// query, so this is a single compare-and-set at the database: of any number of callers racing
// for the same slot, exactly one match (status still 'AVAILABLE') succeeds and every other
// gets back null. This is what guarantees "a slot can never be assigned to two vehicles at
// once" — there is no read-then-write window to interleave.
async function claimSlot(slotId) {
  return ParkingSlot.findOneAndUpdate(
    { id: Number(slotId), status: 'AVAILABLE' },
    { $set: { status: 'OCCUPIED' } },
    { new: true },
  );
}

// Reverse of claimSlot: hand the slot back once its ticket is paid or cancelled. Guarded on
// 'OCCUPIED' so a double release (e.g. cancel racing a payment) is a harmless no-op.
async function releaseSlot(slotId) {
  return ParkingSlot.findOneAndUpdate(
    { id: Number(slotId), status: 'OCCUPIED' },
    { $set: { status: 'AVAILABLE' } },
    { new: true },
  );
}

// First AVAILABLE slot for `vehicleType` that sits in an ACTIVE area of `branchId`. Returns
// null when the branch is full for that vehicle type. The subsequent claimSlot() is still the
// authority — this only narrows the candidate.
async function findAssignableSlot({ branchId, vehicleType }) {
  const areas = await ParkingArea.find({ branch_id: Number(branchId), status: 'ACTIVE' }).select('id');
  if (areas.length === 0) return null;
  return ParkingSlot.findOne({
    parking_area_id: { $in: areas.map((a) => a.id) },
    vehicle_type: vehicleType,
    status: 'AVAILABLE',
  }).sort({ id: 1 });
}

async function countOpenTicketsForSlot(slotId) {
  return ParkingTicket.countDocuments({
    slot_id: Number(slotId),
    status: { $in: ['ACTIVE', 'PENDING_PAYMENT'] },
  });
}

async function countOpenTicketsForArea(areaId) {
  const slots = await ParkingSlot.find({ parking_area_id: Number(areaId) }).select('id');
  if (slots.length === 0) return 0;
  return ParkingTicket.countDocuments({
    slot_id: { $in: slots.map((s) => s.id) },
    status: { $in: ['ACTIVE', 'PENDING_PAYMENT'] },
  });
}

// ---- Parking tickets -----------------------------------------------------

async function findTickets(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    ParkingTicket.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    ParkingTicket.countDocuments(filter),
  ]);
  return { data, total };
}

async function findTicketById(id) {
  return ParkingTicket.findOne({ id: Number(id) });
}

async function findTicketByCode(code) {
  return ParkingTicket.findOne({ ticket_code: String(code).toUpperCase() });
}

async function findActiveTicketForSlot(slotId) {
  return ParkingTicket.findOne({ slot_id: Number(slotId), status: 'ACTIVE' });
}

async function findBranchIdByTicketId(id) {
  const ticket = await ParkingTicket.findOne({ id: Number(id) });
  return ticket ? ticket.branch_id : null;
}

async function createTicket(data) {
  return ParkingTicket.create(data);
}

// Atomic ticket lifecycle step: only applies `updates` while the ticket is still in
// `fromStatus`, so two racing exits (or two payments) on the same ticket can't both take
// effect — the loser's findOneAndUpdate matches nothing and returns null. Never read the
// ticket then save it for a status change.
async function transitionTicket(id, fromStatus, updates) {
  return ParkingTicket.findOneAndUpdate(
    { id: Number(id), status: fromStatus },
    { $set: updates },
    { new: true },
  );
}

module.exports = {
  findAreas,
  findAreaById,
  findBranchIdByAreaId,
  createArea,
  updateArea,
  removeArea,
  countSlotsForArea,
  findSlots,
  findSlotById,
  findSlotByAreaAndCode,
  findBranchIdBySlotId,
  createSlot,
  updateSlot,
  removeSlot,
  claimSlot,
  releaseSlot,
  findAssignableSlot,
  countOpenTicketsForSlot,
  countOpenTicketsForArea,
  findTickets,
  findTicketById,
  findTicketByCode,
  findActiveTicketForSlot,
  findBranchIdByTicketId,
  createTicket,
  transitionTicket,
};
