const MaintenanceRequest = require('../models/MaintenanceRequest');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    MaintenanceRequest.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    MaintenanceRequest.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return MaintenanceRequest.findOne({ id: Number(id) });
}

async function findBranchIdByRequestId(id) {
  const request = await MaintenanceRequest.findOne({ id: Number(id) });
  return request ? request.branch_id : null;
}

async function create(data) {
  return MaintenanceRequest.create(data);
}

async function updateFields(id, updates) {
  return MaintenanceRequest.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

// OPEN or ASSIGNED -> ASSIGNED. Allowing it from ASSIGNED too means an admin can hand the
// ticket to a different employee before work has started.
async function assign(id, { employeeId, assignedBy }) {
  return MaintenanceRequest.findOneAndUpdate(
    { id: Number(id), status: { $in: ['OPEN', 'ASSIGNED'] } },
    { $set: { status: 'ASSIGNED', assigned_employee_id: employeeId, assigned_by: assignedBy, assigned_at: new Date() } },
    { new: true },
  );
}

// ASSIGNED -> IN_PROGRESS
async function start(id) {
  return MaintenanceRequest.findOneAndUpdate(
    { id: Number(id), status: 'ASSIGNED' },
    { $set: { status: 'IN_PROGRESS', started_at: new Date() } },
    { new: true },
  );
}

// IN_PROGRESS -> RESOLVED
async function resolve(id, { resolutionNote }) {
  return MaintenanceRequest.findOneAndUpdate(
    { id: Number(id), status: 'IN_PROGRESS' },
    { $set: { status: 'RESOLVED', resolved_at: new Date(), resolution_note: resolutionNote ?? null } },
    { new: true },
  );
}

// RESOLVED -> CLOSED
async function close(id, { closedBy }) {
  return MaintenanceRequest.findOneAndUpdate(
    { id: Number(id), status: 'RESOLVED' },
    { $set: { status: 'CLOSED', closed_at: new Date(), closed_by: closedBy } },
    { new: true },
  );
}

async function remove(id) {
  return MaintenanceRequest.deleteOne({ id: Number(id) });
}

// Other still-open requests against the same Room (used to decide whether resolving/deleting
// this one is safe to also flip the Room back to ACTIVE — see maintenanceRequest.controller).
async function countActiveForRoom(roomId, { excludeId } = {}) {
  const filter = {
    resource_type: 'ROOM',
    room_id: Number(roomId),
    status: { $in: MaintenanceRequest.ACTIVE_STATUSES },
  };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return MaintenanceRequest.countDocuments(filter);
}

module.exports = {
  findFiltered,
  findById,
  findBranchIdByRequestId,
  create,
  updateFields,
  assign,
  start,
  resolve,
  close,
  remove,
  countActiveForRoom,
};
