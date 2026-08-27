const SupportTicket = require('../models/SupportTicket');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    SupportTicket.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    SupportTicket.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return SupportTicket.findOne({ id: Number(id) });
}

async function findBranchIdByTicketId(id) {
  const ticket = await SupportTicket.findOne({ id: Number(id) });
  return ticket ? ticket.branch_id : null;
}

async function create(data) {
  return SupportTicket.create(data);
}

async function updateFields(id, updates) {
  return SupportTicket.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

// A rep picks up an unclaimed ticket themselves. OPEN -> IN_PROGRESS.
async function claim(id, { employeeId }) {
  return SupportTicket.findOneAndUpdate(
    { id: Number(id), status: 'OPEN' },
    { $set: { status: 'IN_PROGRESS', assigned_employee_id: employeeId, assigned_by: employeeId, assigned_at: new Date() } },
    { new: true },
  );
}

// Branch Admin routes/reroutes a ticket to a specific employee. OPEN or IN_PROGRESS -> IN_PROGRESS,
// so a ticket can be handed to a different rep after work has already started.
async function assign(id, { employeeId, assignedBy }) {
  return SupportTicket.findOneAndUpdate(
    { id: Number(id), status: { $in: ['OPEN', 'IN_PROGRESS'] } },
    { $set: { status: 'IN_PROGRESS', assigned_employee_id: employeeId, assigned_by: assignedBy, assigned_at: new Date() } },
    { new: true },
  );
}

// IN_PROGRESS -> RESOLVED
async function resolve(id, { resolutionNote }) {
  return SupportTicket.findOneAndUpdate(
    { id: Number(id), status: 'IN_PROGRESS' },
    { $set: { status: 'RESOLVED', resolved_at: new Date(), resolution_note: resolutionNote ?? null } },
    { new: true },
  );
}

// RESOLVED -> CLOSED
async function close(id, { closedBy }) {
  return SupportTicket.findOneAndUpdate(
    { id: Number(id), status: 'RESOLVED' },
    { $set: { status: 'CLOSED', closed_at: new Date(), closed_by: closedBy } },
    { new: true },
  );
}

async function remove(id) {
  return SupportTicket.deleteOne({ id: Number(id) });
}

module.exports = {
  findFiltered,
  findById,
  findBranchIdByTicketId,
  create,
  updateFields,
  claim,
  assign,
  resolve,
  close,
  remove,
};
