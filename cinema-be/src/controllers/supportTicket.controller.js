const supportTicketRepository = require('../repositories/supportTicket.repository');
const employeeRepository = require('../repositories/employee.repository');
const userRepository = require('../repositories/user.repository');
const SupportTicket = require('../models/SupportTicket');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const CATEGORIES = SupportTicket.CATEGORIES;
const STATUSES = SupportTicket.STATUSES;

// GET /api/support-tickets?status=&category=&customerId=&assignedEmployeeId=&page=&limit=
// (supportTicket.read permission, branch-scoped by the route's resolveListAccess -> req.branchId)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.category && CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.customerId) filter.customer_id = Number(req.query.customerId);
  if (req.query.assignedEmployeeId) filter.assigned_employee_id = Number(req.query.assignedEmployeeId);

  const { data, total } = await supportTicketRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/support-tickets/:id (supportTicket.read permission, branch-scoped)
async function getById(req, res) {
  const ticket = await supportTicketRepository.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });
  res.json(ticket);
}

// POST /api/support-tickets { customer_id, category?, subject, description? } (supportTicket.create
// permission, branch-scoped)
async function create(req, res) {
  const { customer_id, subject } = req.body;
  const branch_id = req.branchId;

  if (!customer_id || !subject) {
    return res.status(400).json({ message: 'customer_id and subject are required' });
  }
  const category = req.body.category || 'GENERAL';
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `category must be one of ${CATEGORIES.join(', ')}`, code: 'INVALID_CATEGORY' });
  }

  const customer = await userRepository.findById(customer_id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const id = await nextId('supportTicket');
  const ticket = await supportTicketRepository.create({
    id,
    customer_id: customer.id,
    branch_id,
    category,
    subject,
    description: req.body.description || '',
    status: 'OPEN',
    created_by: req.account.accountId,
  });

  res.status(201).json(ticket);
}

// PUT /api/support-tickets/:id { subject, description, category } (supportTicket.update permission,
// branch-scoped) — a CLOSED ticket's record is final and no longer editable.
async function update(req, res) {
  const ticket = await supportTicketRepository.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });
  if (ticket.status === 'CLOSED') {
    return res.status(400).json({ message: 'A closed support ticket cannot be edited', code: 'SUPPORT_TICKET_CLOSED' });
  }

  const updates = {};
  if (req.body.subject !== undefined) {
    if (!req.body.subject) return res.status(400).json({ message: 'subject cannot be empty' });
    updates.subject = req.body.subject;
  }
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.category !== undefined) {
    if (!CATEGORIES.includes(req.body.category)) {
      return res.status(400).json({ message: `category must be one of ${CATEGORIES.join(', ')}`, code: 'INVALID_CATEGORY' });
    }
    updates.category = req.body.category;
  }

  const updated = await supportTicketRepository.updateFields(ticket.id, updates);
  res.json(updated);
}

// POST /api/support-tickets/:id/claim (supportTicket.update permission, branch-scoped) — the
// calling staff member picks up an unclaimed (OPEN) ticket themselves.
async function claim(req, res) {
  const ticket = await supportTicketRepository.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });

  if (!req.employee) {
    return res.status(400).json({ message: 'Only a staffed employee can claim a ticket', code: 'NOT_AN_EMPLOYEE' });
  }

  const updated = await supportTicketRepository.claim(ticket.id, { employeeId: req.employee.id });
  if (!updated) {
    return res.status(400).json({
      message: `Only an OPEN ticket can be claimed (current status: ${ticket.status})`,
      code: 'SUPPORT_TICKET_NOT_CLAIMABLE',
    });
  }
  res.json(updated);
}

// POST /api/support-tickets/:id/assign { employee_id } (supportTicket.assign permission, branch-scoped)
async function assign(req, res) {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ message: 'employee_id is required' });

  const ticket = await supportTicketRepository.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });

  const employee = await employeeRepository.findById(employee_id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  if (employee.status !== 1) return res.status(400).json({ message: 'Employee is not active', code: 'EMPLOYEE_NOT_ACTIVE' });
  if (employee.branch_id !== ticket.branch_id) {
    return res.status(400).json({ message: 'Employee must belong to the same branch as the ticket', code: 'BRANCH_MISMATCH' });
  }

  const updated = await supportTicketRepository.assign(ticket.id, { employeeId: employee.id, assignedBy: req.account.accountId });
  if (!updated) {
    return res.status(400).json({
      message: `Only an OPEN or IN_PROGRESS ticket can be assigned (current status: ${ticket.status})`,
      code: 'SUPPORT_TICKET_NOT_ASSIGNABLE',
    });
  }
  res.json(updated);
}

// POST /api/support-tickets/:id/resolve { resolution_note } (supportTicket.update permission,
// branch-scoped) — IN_PROGRESS -> RESOLVED
async function resolve(req, res) {
  const ticket = await supportTicketRepository.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });

  const updated = await supportTicketRepository.resolve(ticket.id, { resolutionNote: req.body?.resolution_note });
  if (!updated) {
    return res.status(400).json({
      message: `Only an IN_PROGRESS ticket can be resolved (current status: ${ticket.status})`,
      code: 'SUPPORT_TICKET_NOT_IN_PROGRESS',
    });
  }
  res.json(updated);
}

// POST /api/support-tickets/:id/close (supportTicket.close permission, branch-scoped) — RESOLVED -> CLOSED
async function close(req, res) {
  const ticket = await supportTicketRepository.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });

  const updated = await supportTicketRepository.close(ticket.id, { closedBy: req.account.accountId });
  if (!updated) {
    return res.status(400).json({
      message: `Only a RESOLVED ticket can be closed (current status: ${ticket.status})`,
      code: 'SUPPORT_TICKET_NOT_RESOLVED',
    });
  }
  res.json(updated);
}

// DELETE /api/support-tickets/:id (supportTicket.delete permission, branch-scoped) — only a
// mistakenly opened ticket (no work started yet) can be deleted outright.
async function remove(req, res) {
  const ticket = await supportTicketRepository.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Support ticket not found' });
  if (ticket.status !== 'OPEN') {
    return res.status(400).json({
      message: 'Only an OPEN support ticket can be deleted',
      code: 'SUPPORT_TICKET_NOT_DELETABLE',
    });
  }

  await supportTicketRepository.remove(ticket.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, claim, assign, resolve, close, remove };
