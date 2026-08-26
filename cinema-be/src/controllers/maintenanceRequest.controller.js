const maintenanceRequestRepository = require('../repositories/maintenanceRequest.repository');
const roomRepository = require('../repositories/room.repository');
const seatRepository = require('../repositories/seat.repository');
const employeeRepository = require('../repositories/employee.repository');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const RESOURCE_TYPES = MaintenanceRequest.RESOURCE_TYPES;
const STATUSES = MaintenanceRequest.STATUSES;

// A ROOM under an open maintenance issue is put into Room.status = MAINTENANCE, which blocks new
// Showtimes for it (schedule.controller). Existing Showtimes are deliberately left untouched —
// cancelling them is a separate business process, not something this ticket auto-triggers.
async function putRoomUnderMaintenance(roomId) {
  const room = await roomRepository.findById(roomId);
  if (room && room.status === 'ACTIVE') {
    await roomRepository.updateFields(room.id, { status: 'MAINTENANCE' });
  }
}

// Reverses putRoomUnderMaintenance once a Room has no more open maintenance requests against
// it. Only restores from MAINTENANCE (never touches a Room an admin manually set to CLOSED).
async function maybeRestoreRoomStatus(request) {
  if (request.resource_type !== 'ROOM' || !request.room_id) return;
  const stillActive = await maintenanceRequestRepository.countActiveForRoom(request.room_id, { excludeId: request.id });
  if (stillActive > 0) return;
  const room = await roomRepository.findById(request.room_id);
  if (room && room.status === 'MAINTENANCE') {
    await roomRepository.updateFields(room.id, { status: 'ACTIVE' });
  }
}

// GET /api/maintenance?status=&resourceType=&roomId=&page=&limit= (maintenance.read permission,
// branch-scoped by the route's resolveListAccess -> req.branchId)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.resourceType && RESOURCE_TYPES.includes(req.query.resourceType)) filter.resource_type = req.query.resourceType;
  if (req.query.roomId) filter.room_id = Number(req.query.roomId);

  const { data, total } = await maintenanceRequestRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/maintenance/:id (maintenance.read permission, branch-scoped)
async function getById(req, res) {
  const request = await maintenanceRequestRepository.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Maintenance request not found' });
  res.json(request);
}

// POST /api/maintenance { branch_id, resource_type, room_id?, seat_id?, resource_name?, title,
// description? } (maintenance.create permission, branch-scoped)
async function create(req, res) {
  const { resource_type, title, description } = req.body;
  const branch_id = req.branchId;

  if (!resource_type || !title) {
    return res.status(400).json({ message: 'resource_type and title are required' });
  }
  if (!RESOURCE_TYPES.includes(resource_type)) {
    return res.status(400).json({ message: `resource_type must be one of ${RESOURCE_TYPES.join(', ')}`, code: 'INVALID_RESOURCE_TYPE' });
  }

  let room_id = null;
  let seat_id = null;
  let resource_name = req.body.resource_name ? String(req.body.resource_name).trim() : '';

  if (resource_type === 'ROOM') {
    if (!req.body.room_id) return res.status(400).json({ message: 'room_id is required for a ROOM maintenance request' });
    const room = await roomRepository.findById(req.body.room_id);
    if (!room || room.cinema_id !== branch_id) return res.status(404).json({ message: 'Room not found' });
    room_id = room.id;
    resource_name = resource_name || room.name;
  } else if (resource_type === 'SEAT') {
    if (!req.body.seat_id) return res.status(400).json({ message: 'seat_id is required for a SEAT maintenance request' });
    const seat = await seatRepository.findById(req.body.seat_id);
    if (!seat) return res.status(404).json({ message: 'Seat not found' });
    const room = await roomRepository.findById(seat.room_id);
    if (!room || room.cinema_id !== branch_id) return res.status(404).json({ message: 'Seat not found' });
    seat_id = seat.id;
    room_id = room.id;
    resource_name = resource_name || seat.seat_code;
  } else {
    if (!resource_name) {
      return res.status(400).json({ message: 'resource_name is required for this resource_type', code: 'RESOURCE_NAME_REQUIRED' });
    }
    if (req.body.room_id) {
      const room = await roomRepository.findById(req.body.room_id);
      if (!room || room.cinema_id !== branch_id) return res.status(404).json({ message: 'Room not found' });
      room_id = room.id;
    }
  }

  const id = await nextId('maintenanceRequest');
  const request = await maintenanceRequestRepository.create({
    id,
    branch_id,
    resource_type,
    room_id,
    seat_id,
    resource_name,
    title,
    description: description || '',
    status: 'OPEN',
    reported_by: req.account.accountId,
  });

  if (resource_type === 'ROOM') await putRoomUnderMaintenance(room_id);

  res.status(201).json(request);
}

// PUT /api/maintenance/:id { title, description, resource_name } (maintenance.update permission,
// branch-scoped) — a CLOSED request's record is final and no longer editable.
async function update(req, res) {
  const request = await maintenanceRequestRepository.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Maintenance request not found' });
  if (request.status === 'CLOSED') {
    return res.status(400).json({ message: 'A closed maintenance request cannot be edited', code: 'MAINTENANCE_CLOSED' });
  }

  const updates = {};
  if (req.body.title !== undefined) {
    if (!req.body.title) return res.status(400).json({ message: 'title cannot be empty' });
    updates.title = req.body.title;
  }
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.resource_name !== undefined) updates.resource_name = req.body.resource_name;

  const updated = await maintenanceRequestRepository.updateFields(request.id, updates);
  res.json(updated);
}

// POST /api/maintenance/:id/assign { employee_id } (maintenance.assign permission, branch-scoped)
// OPEN/ASSIGNED -> ASSIGNED
async function assign(req, res) {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ message: 'employee_id is required' });

  const request = await maintenanceRequestRepository.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Maintenance request not found' });

  const employee = await employeeRepository.findById(employee_id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  if (employee.status !== 1) return res.status(400).json({ message: 'Employee is not active', code: 'EMPLOYEE_NOT_ACTIVE' });
  if (employee.branch_id !== request.branch_id) {
    return res.status(400).json({ message: 'Employee must belong to the same branch as the request', code: 'BRANCH_MISMATCH' });
  }

  const updated = await maintenanceRequestRepository.assign(request.id, { employeeId: employee.id, assignedBy: req.account.accountId });
  if (!updated) {
    return res.status(400).json({
      message: `Only an OPEN or ASSIGNED request can be assigned (current status: ${request.status})`,
      code: 'MAINTENANCE_NOT_ASSIGNABLE',
    });
  }
  res.json(updated);
}

// POST /api/maintenance/:id/start (maintenance.update permission, branch-scoped) — ASSIGNED -> IN_PROGRESS
async function start(req, res) {
  const request = await maintenanceRequestRepository.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Maintenance request not found' });

  const updated = await maintenanceRequestRepository.start(request.id);
  if (!updated) {
    return res.status(400).json({
      message: `Only an ASSIGNED request can be started (current status: ${request.status})`,
      code: 'MAINTENANCE_NOT_ASSIGNED',
    });
  }
  res.json(updated);
}

// POST /api/maintenance/:id/resolve { resolution_note } (maintenance.update permission,
// branch-scoped) — IN_PROGRESS -> RESOLVED
async function resolve(req, res) {
  const request = await maintenanceRequestRepository.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Maintenance request not found' });

  const updated = await maintenanceRequestRepository.resolve(request.id, { resolutionNote: req.body?.resolution_note });
  if (!updated) {
    return res.status(400).json({
      message: `Only an IN_PROGRESS request can be resolved (current status: ${request.status})`,
      code: 'MAINTENANCE_NOT_IN_PROGRESS',
    });
  }

  await maybeRestoreRoomStatus(updated);
  res.json(updated);
}

// POST /api/maintenance/:id/close (maintenance.close permission, branch-scoped) — RESOLVED -> CLOSED
async function close(req, res) {
  const request = await maintenanceRequestRepository.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Maintenance request not found' });

  const updated = await maintenanceRequestRepository.close(request.id, { closedBy: req.account.accountId });
  if (!updated) {
    return res.status(400).json({
      message: `Only a RESOLVED request can be closed (current status: ${request.status})`,
      code: 'MAINTENANCE_NOT_RESOLVED',
    });
  }
  res.json(updated);
}

// DELETE /api/maintenance/:id (maintenance.delete permission, branch-scoped) — only a mistakenly
// opened request (no work started yet) can be deleted outright; anything further along must be
// carried through resolve/close so its history isn't lost.
async function remove(req, res) {
  const request = await maintenanceRequestRepository.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Maintenance request not found' });
  if (request.status !== 'OPEN') {
    return res.status(400).json({
      message: 'Only an OPEN maintenance request can be deleted',
      code: 'MAINTENANCE_NOT_DELETABLE',
    });
  }

  await maintenanceRequestRepository.remove(request.id);
  await maybeRestoreRoomStatus(request);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, assign, start, resolve, close, remove };
