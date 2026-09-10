const parkingRepository = require('../repositories/parking.repository');
const ParkingArea = require('../models/ParkingArea');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingTicket = require('../models/ParkingTicket');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { calculateParkingFee } = require('../services/parkingFee');
const { generateParkingTicketCode } = require('../utils/parkingTicketCode');

const AREA_STATUSES = ParkingArea.STATUSES;
const SLOT_STATUSES = ParkingSlot.STATUSES;
const VEHICLE_TYPES = ParkingSlot.VEHICLE_TYPES;
const TICKET_STATUSES = ParkingTicket.STATUSES;

// ---- Parking areas --------------------------------------------------------

// GET /api/parking/areas?branchId=&status=&page=&limit= (parking.read, branch-scoped by the
// route's resolveListAccess -> req.branchId; null means an ALL-scope caller wants every branch)
async function listAreas(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && AREA_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await parkingRepository.findAreas(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/parking/areas/:id (parking.read, branch-scoped)
async function getArea(req, res) {
  const area = await parkingRepository.findAreaById(req.params.id);
  if (!area) return res.status(404).json({ message: 'Parking area not found' });
  res.json(area);
}

// POST /api/parking/areas { branch_id, name, capacity?, status? } (parking.manage, branch-scoped)
async function createArea(req, res) {
  const branch_id = req.branchId;
  const name = req.body.name ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ message: 'name is required' });

  const capacityError = validateCapacity(req.body.capacity);
  if (capacityError) return res.status(400).json(capacityError);

  const statusError = validateEnum(req.body.status, AREA_STATUSES);
  if (statusError) return res.status(400).json(statusError);

  const id = await nextId('parkingArea');
  const area = await parkingRepository.createArea({
    id,
    branch_id,
    name,
    capacity: req.body.capacity === undefined ? 0 : Number(req.body.capacity),
    status: req.body.status || 'ACTIVE',
  });
  res.status(201).json(area);
}

// PUT /api/parking/areas/:id { name?, capacity?, status? } (parking.manage, branch-scoped). The
// branch is immutable — a parking area cannot be moved to another branch.
async function updateArea(req, res) {
  const area = await parkingRepository.findAreaById(req.params.id);
  if (!area) return res.status(404).json({ message: 'Parking area not found' });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.capacity !== undefined) {
    const capacityError = validateCapacity(req.body.capacity);
    if (capacityError) return res.status(400).json(capacityError);
    updates.capacity = Number(req.body.capacity);
  }
  if (req.body.status !== undefined) {
    const statusError = validateEnum(req.body.status, AREA_STATUSES);
    if (statusError) return res.status(400).json(statusError);
    updates.status = req.body.status;
  }

  const updated = await parkingRepository.updateArea(area.id, updates);
  res.json(updated);
}

// DELETE /api/parking/areas/:id (parking.manage) — refused while it still has slots, which
// would otherwise leave orphaned ParkingSlot rows.
async function removeArea(req, res) {
  const area = await parkingRepository.findAreaById(req.params.id);
  if (!area) return res.status(404).json({ message: 'Parking area not found' });

  if ((await parkingRepository.countSlotsForArea(area.id)) > 0) {
    return res.status(409).json({ message: 'Remove this area’s slots first', code: 'AREA_HAS_SLOTS' });
  }

  await parkingRepository.removeArea(area.id);
  res.json({ message: 'Deleted' });
}

// ---- Parking slots ------------------------------------------------------

// GET /api/parking/slots?areaId=&branchId=&vehicleType=&status=&page=&limit= (parking.read).
// A BRANCH-scoped caller must scope by an areaId they can access (see the route resolver);
// req.branchId (when set) further constrains the list to that branch's areas.
async function listSlots(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.areaId) {
    filter.parking_area_id = Number(req.query.areaId);
  } else if (req.branchId !== null && req.branchId !== undefined) {
    const areas = await parkingRepository.findAreas({ branch_id: req.branchId }, { limit: 1000 });
    filter.parking_area_id = { $in: areas.data.map((a) => a.id) };
  }
  if (req.query.vehicleType && VEHICLE_TYPES.includes(req.query.vehicleType)) {
    filter.vehicle_type = req.query.vehicleType;
  }
  if (req.query.status && SLOT_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await parkingRepository.findSlots(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/parking/slots/:id (parking.read, branch-scoped via its area)
async function getSlot(req, res) {
  const slot = await parkingRepository.findSlotById(req.params.id);
  if (!slot) return res.status(404).json({ message: 'Parking slot not found' });
  res.json(slot);
}

// POST /api/parking/slots { parking_area_id, slot_code, vehicle_type?, status? }
// (parking.manage). The route has already confirmed the caller can access parking_area_id's
// branch.
async function createSlot(req, res) {
  const area = await parkingRepository.findAreaById(req.body.parking_area_id);
  if (!area) return res.status(404).json({ message: 'Parking area not found' });

  const slot_code = req.body.slot_code ? String(req.body.slot_code).trim() : '';
  if (!slot_code) return res.status(400).json({ message: 'slot_code is required' });
  if (await parkingRepository.findSlotByAreaAndCode(area.id, slot_code)) {
    return res.status(409).json({ message: 'A slot with this code already exists in this area', code: 'SLOT_CODE_TAKEN' });
  }

  const vehicleError = validateEnum(req.body.vehicle_type, VEHICLE_TYPES, 'vehicle_type');
  if (vehicleError) return res.status(400).json(vehicleError);
  const statusError = validateEnum(req.body.status, SLOT_STATUSES);
  if (statusError) return res.status(400).json(statusError);

  const id = await nextId('parkingSlot');
  const slot = await parkingRepository.createSlot({
    id,
    parking_area_id: area.id,
    slot_code,
    vehicle_type: req.body.vehicle_type || 'CAR',
    status: req.body.status || 'AVAILABLE',
  });
  res.status(201).json(slot);
}

// PUT /api/parking/slots/:id { slot_code?, vehicle_type?, status? } (parking.manage). The
// parking_area_id is immutable. The status cannot be hand-edited while a vehicle is parked
// here — end the parking session instead.
async function updateSlot(req, res) {
  const slot = await parkingRepository.findSlotById(req.params.id);
  if (!slot) return res.status(404).json({ message: 'Parking slot not found' });

  const updates = {};
  if (req.body.slot_code !== undefined) {
    const slot_code = String(req.body.slot_code).trim();
    if (!slot_code) return res.status(400).json({ message: 'slot_code cannot be empty' });
    if (await parkingRepository.findSlotByAreaAndCode(slot.parking_area_id, slot_code, { excludeId: slot.id })) {
      return res.status(409).json({ message: 'A slot with this code already exists in this area', code: 'SLOT_CODE_TAKEN' });
    }
    updates.slot_code = slot_code;
  }
  if (req.body.vehicle_type !== undefined) {
    const vehicleError = validateEnum(req.body.vehicle_type, VEHICLE_TYPES, 'vehicle_type');
    if (vehicleError) return res.status(400).json(vehicleError);
    if (slot.status === 'OCCUPIED') {
      return res.status(409).json({ message: 'Cannot change vehicle type while the slot is occupied', code: 'SLOT_OCCUPIED' });
    }
    updates.vehicle_type = req.body.vehicle_type;
  }
  if (req.body.status !== undefined) {
    const statusError = validateEnum(req.body.status, SLOT_STATUSES);
    if (statusError) return res.status(400).json(statusError);
    if (slot.status === 'OCCUPIED' && req.body.status !== 'OCCUPIED') {
      return res.status(409).json({ message: 'A vehicle is parked here — end its parking session first', code: 'SLOT_OCCUPIED' });
    }
    if (req.body.status === 'OCCUPIED' && slot.status !== 'OCCUPIED') {
      return res.status(409).json({ message: 'A slot is only occupied by admitting a vehicle', code: 'SLOT_STATUS_MANAGED' });
    }
    updates.status = req.body.status;
  }

  const updated = await parkingRepository.updateSlot(slot.id, updates);
  res.json(updated);
}

// DELETE /api/parking/slots/:id (parking.manage) — refused while occupied or referenced by an
// open ticket.
async function removeSlot(req, res) {
  const slot = await parkingRepository.findSlotById(req.params.id);
  if (!slot) return res.status(404).json({ message: 'Parking slot not found' });

  if (slot.status === 'OCCUPIED' || (await parkingRepository.countOpenTicketsForSlot(slot.id)) > 0) {
    return res.status(409).json({ message: 'This slot is in use', code: 'SLOT_IN_USE' });
  }

  await parkingRepository.removeSlot(slot.id);
  res.json({ message: 'Deleted' });
}

// ---- Parking ticket flow -------------------------------------------------
// Vehicle Entry -> Assign Slot -> Parking -> Vehicle Exit -> Calculate Fee -> Payment -> Release Slot

// POST /api/parking/tickets { branch_id, vehicle_type, vehicle_plate, slot_id? }
// (parking.operate, branch-scoped). Assigns a slot and opens an ACTIVE ticket. The slot claim
// and the ticket insert together form the "transaction": the slot is claimed with a single
// atomic compare-and-set (parkingRepository.claimSlot), and if the ticket insert then fails
// the claim is compensated (releaseSlot) so a slot is never left OCCUPIED with no ticket.
async function enterVehicle(req, res) {
  const branch_id = req.branchId;

  const vehicleError = validateEnum(req.body.vehicle_type, VEHICLE_TYPES, 'vehicle_type', true);
  if (vehicleError) return res.status(400).json(vehicleError);
  const vehicle_type = req.body.vehicle_type;

  const vehicle_plate = req.body.vehicle_plate ? String(req.body.vehicle_plate).trim().toUpperCase() : '';
  if (!vehicle_plate) return res.status(400).json({ message: 'vehicle_plate is required' });

  // Acquire a slot. An explicit slot_id must belong to this branch and match the vehicle type;
  // otherwise auto-assign a free slot for that type. Either way the slot is taken with a single
  // atomic compare-and-set (claimSlot) — the one point that stops two vehicles taking one slot.
  let claimed;
  if (req.body.slot_id !== undefined && req.body.slot_id !== null && req.body.slot_id !== '') {
    const targetSlot = await parkingRepository.findSlotById(req.body.slot_id);
    if (!targetSlot) return res.status(404).json({ message: 'Parking slot not found' });
    const slotBranchId = await parkingRepository.findBranchIdByAreaId(targetSlot.parking_area_id);
    if (Number(slotBranchId) !== Number(branch_id)) {
      return res.status(403).json({ message: 'That slot belongs to a different branch', code: 'PARKING_BRANCH_MISMATCH' });
    }
    if (targetSlot.vehicle_type !== vehicle_type) {
      return res.status(409).json({ message: 'That slot is for a different vehicle type', code: 'SLOT_VEHICLE_TYPE_MISMATCH' });
    }
    claimed = await parkingRepository.claimSlot(targetSlot.id);
    if (!claimed) {
      return res.status(409).json({ message: 'That slot was just taken', code: 'SLOT_NOT_AVAILABLE' });
    }
  } else {
    // Auto-assign: if two arrivals race for the same candidate, the loser re-scans and takes
    // the next free slot instead of failing. Bounded so a genuinely full branch still returns.
    let sawCandidate = false;
    for (let attempt = 0; attempt < 8 && !claimed; attempt += 1) {
      const candidate = await parkingRepository.findAssignableSlot({ branchId: branch_id, vehicleType: vehicle_type });
      if (!candidate) break;
      sawCandidate = true;
      claimed = await parkingRepository.claimSlot(candidate.id);
    }
    if (!claimed) {
      return res.status(409).json({
        message: sawCandidate ? 'Every free slot was taken concurrently' : 'No free slot for this vehicle type',
        code: sawCandidate ? 'SLOT_NOT_AVAILABLE' : 'PARKING_FULL',
      });
    }
  }

  try {
    const id = await nextId('parkingTicket');
    const ticket = await parkingRepository.createTicket({
      id,
      ticket_code: generateParkingTicketCode(),
      branch_id,
      slot_id: claimed.id,
      vehicle_type,
      vehicle_plate,
      entry_at: new Date(),
      status: 'ACTIVE',
      fee: 0,
    });
    res.status(201).json(ticket);
  } catch (err) {
    // Compensating release so the claim above is not left dangling.
    await parkingRepository.releaseSlot(claimed.id);
    throw err;
  }
}

// POST /api/parking/tickets/:id/exit (parking.operate, branch-scoped). Records the exit time,
// computes the fee, and moves the ticket ACTIVE -> PENDING_PAYMENT. The slot stays OCCUPIED
// until payment. Atomic on the ACTIVE guard so a double exit can't recompute the fee.
async function exitVehicle(req, res) {
  const ticket = await parkingRepository.findTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Parking ticket not found' });
  if (ticket.status !== 'ACTIVE') {
    return res.status(409).json({ message: `Ticket is ${ticket.status}, not ACTIVE`, code: 'TICKET_NOT_ACTIVE' });
  }

  const exit_at = new Date();
  let fee;
  try {
    ({ fee } = calculateParkingFee({ entryAt: ticket.entry_at, exitAt: exit_at, vehicleType: ticket.vehicle_type }));
  } catch (err) {
    return res.status(400).json({ message: err.message, code: 'FEE_CALCULATION_FAILED' });
  }

  const updated = await parkingRepository.transitionTicket(ticket.id, 'ACTIVE', {
    status: 'PENDING_PAYMENT',
    exit_at,
    fee,
  });
  if (!updated) {
    return res.status(409).json({ message: 'Ticket is no longer ACTIVE', code: 'TICKET_NOT_ACTIVE' });
  }
  res.json(updated);
}

// POST /api/parking/tickets/:id/payment (parking.operate, branch-scoped). Settles the fee,
// moves PENDING_PAYMENT -> COMPLETED, then releases the slot. The ticket transition is atomic
// so only one payment wins; releasing the slot afterwards is the last, idempotent step.
async function payTicket(req, res) {
  const ticket = await parkingRepository.findTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Parking ticket not found' });
  if (ticket.status !== 'PENDING_PAYMENT') {
    return res.status(409).json({ message: `Ticket is ${ticket.status}, not PENDING_PAYMENT`, code: 'TICKET_NOT_PENDING_PAYMENT' });
  }

  const updated = await parkingRepository.transitionTicket(ticket.id, 'PENDING_PAYMENT', {
    status: 'COMPLETED',
    paid_at: new Date(),
  });
  if (!updated) {
    return res.status(409).json({ message: 'Ticket is no longer awaiting payment', code: 'TICKET_NOT_PENDING_PAYMENT' });
  }

  await parkingRepository.releaseSlot(updated.slot_id);
  res.json(updated);
}

// POST /api/parking/tickets/:id/cancel (parking.operate, branch-scoped). Voids an ACTIVE
// ticket (vehicle never really parked / admitted by mistake): fee forced to 0, slot released.
async function cancelTicket(req, res) {
  const ticket = await parkingRepository.findTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Parking ticket not found' });
  if (ticket.status !== 'ACTIVE') {
    return res.status(409).json({ message: `Only an ACTIVE ticket can be cancelled (this one is ${ticket.status})`, code: 'TICKET_NOT_ACTIVE' });
  }

  const updated = await parkingRepository.transitionTicket(ticket.id, 'ACTIVE', {
    status: 'CANCELLED',
    exit_at: new Date(),
    fee: 0,
  });
  if (!updated) {
    return res.status(409).json({ message: 'Ticket is no longer ACTIVE', code: 'TICKET_NOT_ACTIVE' });
  }

  await parkingRepository.releaseSlot(updated.slot_id);
  res.json(updated);
}

// GET /api/parking/tickets?branchId=&status=&slotId=&plate=&page=&limit= (parking.read)
async function listTickets(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && TICKET_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.slotId) filter.slot_id = Number(req.query.slotId);
  if (req.query.plate) filter.vehicle_plate = String(req.query.plate).trim().toUpperCase();

  const { data, total } = await parkingRepository.findTickets(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/parking/tickets/:id (parking.read, branch-scoped)
async function getTicket(req, res) {
  const ticket = await parkingRepository.findTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Parking ticket not found' });
  res.json(ticket);
}

// ---- helpers -----------------------------------------------------------

function validateCapacity(raw) {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { message: 'capacity must be a non-negative number', code: 'INVALID_CAPACITY' };
  }
  return null;
}

function validateEnum(raw, allowed, field = 'status', required = false) {
  if (raw === undefined || raw === null || raw === '') {
    return required ? { message: `${field} is required`, code: 'INVALID_VALUE' } : null;
  }
  if (!allowed.includes(raw)) {
    return { message: `${field} must be one of ${allowed.join(', ')}`, code: 'INVALID_VALUE' };
  }
  return null;
}

module.exports = {
  listAreas,
  getArea,
  createArea,
  updateArea,
  removeArea,
  listSlots,
  getSlot,
  createSlot,
  updateSlot,
  removeSlot,
  enterVehicle,
  exitVehicle,
  payTicket,
  cancelTicket,
  listTickets,
  getTicket,
};
