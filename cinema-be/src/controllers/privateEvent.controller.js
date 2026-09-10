const PrivateEvent = require('../models/PrivateEvent');
const EventPackage = require('../models/EventPackage');
const AuditLog = require('../models/AuditLog');
const privateEventRepository = require('../repositories/privateEvent.repository');
const roomRepository = require('../repositories/room.repository');
const branchRepository = require('../repositories/branch.repository');
const employeeRepository = require('../repositories/employee.repository');
const { recordAudit } = require('../services/auditLog.service');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const {
  parseEventWindow,
  coveredDateStrs,
  findShowtimeConflict,
  findEventConflict,
} = require('../utils/eventWindow');

const STATUS = PrivateEvent.STATUS;

// ---- Access helpers ----------------------------------------------------
// A customer only ever touches their own request; a branch admin only their own branches'
// requests; SUPER_ADMIN (ALL scope) anything. `requireBranchAccess` guards the admin routes,
// but the customer-facing routes are permission-only, so ownership is checked here.

function isOwner(req, event) {
  return req.account && Number(event.customer_id) === Number(req.account.accountId);
}

async function canAccessBranch(req, branchId) {
  if (req.permissionScope === 'ALL') return true;
  const branch = await branchRepository.findById(branchId);
  if (!branch) return false;
  if (branch.owner_id === req.account.accountId) return true;
  const employee = await employeeRepository.findActiveByAccountAndBranch(req.account.accountId, branchId);
  return Boolean(employee);
}

// May this caller read this event? Owner customer -> yes. Otherwise needs branch access
// (BRANCH scope) or ALL scope.
async function canReadEvent(req, event) {
  if (isOwner(req, event)) return true;
  return canAccessBranch(req, event.branch_id);
}

function forbidden(res, message = 'Forbidden') {
  return res.status(403).json({ message });
}

// ---- Shared validation ----------------------------------------------

// Confirms the room exists, belongs to `branchId`, and is ACTIVE ("AVAILABLE"). Returns the
// room, or writes an error response and returns null.
async function resolveRoom(res, { roomId, branchId }) {
  const room = await roomRepository.findById(roomId);
  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return null;
  }
  if (Number(room.cinema_id) !== Number(branchId)) {
    res.status(400).json({ message: 'That room does not belong to the selected branch', code: 'ROOM_BRANCH_MISMATCH' });
    return null;
  }
  if (room.status !== 'ACTIVE') {
    res.status(409).json({
      message: `Room is ${String(room.status).toLowerCase()} and is not available for a private event`,
      code: 'ROOM_NOT_AVAILABLE',
    });
    return null;
  }
  return room;
}

// The core rule: the [start, end) window must not overlap any ACTIVE showtime in the room, nor
// any other non-CANCELLED private event. Returns { ok: true } or { code, message, conflict }.
async function checkRoomAvailability({ roomId, start, end, excludeEventId }) {
  const dateStrs = coveredDateStrs(start, end);
  const schedules = await privateEventRepository.findRoomSchedules(roomId, dateStrs);
  const showtime = findShowtimeConflict({ start, end, schedules });
  if (showtime) {
    return {
      code: 'SHOWTIME_CONFLICT',
      message: 'This room already has a showtime scheduled during that time',
      conflict: {
        type: 'SHOWTIME',
        schedule_id: showtime.id,
        movie_date: showtime.movie_date,
        time_begin: showtime.time_begin,
        time_end: showtime.time_end,
      },
    };
  }

  const events = await privateEventRepository.findRoomBlockingEvents(roomId, { excludeId: excludeEventId });
  const other = findEventConflict({ start, end, events, excludeId: excludeEventId });
  if (other) {
    return {
      code: 'EVENT_CONFLICT',
      message: 'Another private event already holds this room during that time',
      conflict: { type: 'EVENT', event_id: other.id, start_at: other.start_at, end_at: other.end_at, status: other.status },
    };
  }

  return { ok: true };
}

function auditBranch(req, action, event, metadata) {
  return recordAudit({
    req,
    action,
    entityType: AuditLog.ENTITY_TYPE.PRIVATE_EVENT,
    entityId: event.id,
    branchId: event.branch_id,
    metadata,
  });
}

// ---- Customer flow --------------------------------------------------

// POST /api/private-events (privateEvent.request, CUSTOMER) — files a quote request.
// { branch_id, room_id, package_id, start_at, end_at, guest_count, title?, contact_name?,
//   contact_phone?, contact_email?, notes? }
async function requestEvent(req, res) {
  const branch_id = Number(req.body.branch_id);
  const room_id = Number(req.body.room_id);
  const package_id = Number(req.body.package_id);
  const guest_count = Number(req.body.guest_count);

  if (!Number.isFinite(branch_id) || !Number.isFinite(room_id) || !Number.isFinite(package_id)) {
    return res.status(400).json({ message: 'branch_id, room_id and package_id are required' });
  }
  if (!Number.isInteger(guest_count) || guest_count < 1) {
    return res.status(400).json({ message: 'guest_count must be a positive integer', code: 'INVALID_GUEST_COUNT' });
  }

  const window = parseEventWindow(req.body);
  if (window.error) return res.status(400).json({ message: window.error, code: window.code });
  if (window.start.getTime() <= Date.now()) {
    return res.status(400).json({ message: 'start_at must be in the future', code: 'EVENT_IN_PAST' });
  }

  const branch = await branchRepository.findById(branch_id);
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  const pkg = await privateEventRepository.findPackageById(package_id);
  if (!pkg) return res.status(404).json({ message: 'Event package not found' });
  if (pkg.status !== 'ACTIVE') {
    return res.status(400).json({ message: 'That event package is not available', code: 'PACKAGE_NOT_ACTIVE' });
  }

  const room = await resolveRoom(res, { roomId: room_id, branchId: branch_id });
  if (!room) return undefined;

  if (pkg.max_guests > 0 && guest_count > pkg.max_guests) {
    return res.status(400).json({
      message: `This package allows at most ${pkg.max_guests} guests`,
      code: 'GUEST_COUNT_EXCEEDS_PACKAGE',
    });
  }
  if (room.capacity > 0 && guest_count > room.capacity) {
    return res.status(400).json({ message: `This room seats at most ${room.capacity}`, code: 'GUEST_COUNT_EXCEEDS_ROOM' });
  }

  const availability = await checkRoomAvailability({ roomId: room_id, start: window.start, end: window.end });
  if (!availability.ok) {
    return res.status(409).json({ message: availability.message, code: availability.code, conflict: availability.conflict });
  }

  const id = await nextId('privateEvent');
  const event = await privateEventRepository.createEvent({
    id,
    customer_id: req.account.accountId,
    branch_id,
    room_id,
    package_id,
    start_at: window.start,
    end_at: window.end,
    guest_count,
    status: STATUS.REQUESTED,
    title: strOr(req.body.title),
    contact_name: strOr(req.body.contact_name),
    contact_phone: strOr(req.body.contact_phone),
    contact_email: strOr(req.body.contact_email),
    notes: strOr(req.body.notes),
  });

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_REQUESTED, event, {
    room_id,
    package_id,
    guest_count,
    start_at: event.start_at,
    end_at: event.end_at,
  });

  res.status(201).json(event);
}

// GET /api/private-events/mine?status=&page=&limit= (privateEvent.request / read) — the
// caller's own requests.
async function listMine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { customer_id: req.account.accountId };
  if (req.query.status && PrivateEvent.STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await privateEventRepository.findEvents(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/private-events/:id/pay (privateEvent.request, CUSTOMER owner) — APPROVED -> PAID.
// Simulated payment (no real gateway). Re-checks room availability first: a showtime could
// have been scheduled in the room between approval and payment.
async function payEvent(req, res) {
  const event = await privateEventRepository.findEventById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Private event not found' });
  if (!isOwner(req, event)) return forbidden(res);
  if (event.status !== STATUS.APPROVED) {
    return res.status(409).json({ message: `Event is ${event.status}, not APPROVED`, code: 'EVENT_NOT_APPROVED' });
  }

  const availability = await checkRoomAvailability({
    roomId: event.room_id,
    start: event.start_at,
    end: event.end_at,
    excludeEventId: event.id,
  });
  if (!availability.ok) {
    return res.status(409).json({ message: availability.message, code: availability.code, conflict: availability.conflict });
  }

  const updated = await privateEventRepository.transitionEvent(event.id, STATUS.APPROVED, {
    status: STATUS.PAID,
    paid_at: new Date(),
  });
  if (!updated) {
    return res.status(409).json({ message: 'Event is no longer APPROVED', code: 'EVENT_NOT_APPROVED' });
  }

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_PAID, updated, { amount: updated.quoted_amount });
  res.json(updated);
}

// POST /api/private-events/:id/cancel (privateEvent.request, CUSTOMER owner) — drop a request
// before it is CONFIRMED. { reason? }
async function cancelOwnEvent(req, res) {
  const event = await privateEventRepository.findEventById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Private event not found' });
  if (!isOwner(req, event)) return forbidden(res);

  const cancellable = [STATUS.REQUESTED, STATUS.QUOTED, STATUS.APPROVED, STATUS.PAID];
  if (!cancellable.includes(event.status)) {
    return res.status(409).json({
      message: `A ${event.status} event can no longer be cancelled by the customer`,
      code: 'EVENT_NOT_CANCELLABLE',
    });
  }

  const updated = await privateEventRepository.transitionEvent(event.id, cancellable, {
    status: STATUS.CANCELLED,
    cancelled_at: new Date(),
    cancel_reason: strOr(req.body.reason) || 'Cancelled by customer',
  });
  if (!updated) return res.status(409).json({ message: 'Event can no longer be cancelled', code: 'EVENT_NOT_CANCELLABLE' });

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_CANCELLED, updated, { by: 'CUSTOMER', reason: updated.cancel_reason });
  res.json(updated);
}

// ---- Admin review flow --------------------------------------------

// GET /api/private-events?branchId=&status=&page=&limit= (privateEvent.read). Branch scope is
// resolved by the route (req.branchId; null = an ALL-scope caller wants every branch).
async function listEvents(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && PrivateEvent.STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await privateEventRepository.findEvents(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/private-events/:id (privateEvent.read) — owner customer or a caller with branch access.
async function getEvent(req, res) {
  const event = await privateEventRepository.findEventById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Private event not found' });
  if (!(await canReadEvent(req, event))) return forbidden(res);
  res.json(event);
}

// POST /api/private-events/:id/quote (privateEvent.review) — REQUESTED -> QUOTED.
// { quoted_amount, quote_notes? }
async function quoteEvent(req, res) {
  const event = req.privateEvent;
  if (event.status !== STATUS.REQUESTED) {
    return res.status(409).json({ message: `Event is ${event.status}, not REQUESTED`, code: 'EVENT_NOT_REQUESTED' });
  }

  const amount = Number(req.body.quoted_amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ message: 'quoted_amount must be a non-negative number', code: 'INVALID_QUOTE' });
  }

  const updated = await privateEventRepository.transitionEvent(event.id, STATUS.REQUESTED, {
    status: STATUS.QUOTED,
    quoted_amount: amount,
    quote_notes: strOr(req.body.quote_notes),
    reviewed_by: req.account.accountId,
    reviewed_at: new Date(),
  });
  if (!updated) return res.status(409).json({ message: 'Event is no longer REQUESTED', code: 'EVENT_NOT_REQUESTED' });

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_QUOTED, updated, { quoted_amount: amount });
  res.json(updated);
}

// POST /api/private-events/:id/approve (privateEvent.review) — QUOTED -> APPROVED. Re-checks
// room availability (a showtime may have landed in the room since the quote).
async function approveEvent(req, res) {
  const event = req.privateEvent;
  if (event.status !== STATUS.QUOTED) {
    return res.status(409).json({ message: `Event is ${event.status}, not QUOTED`, code: 'EVENT_NOT_QUOTED' });
  }

  const availability = await checkRoomAvailability({
    roomId: event.room_id,
    start: event.start_at,
    end: event.end_at,
    excludeEventId: event.id,
  });
  if (!availability.ok) {
    return res.status(409).json({ message: availability.message, code: availability.code, conflict: availability.conflict });
  }

  const updated = await privateEventRepository.transitionEvent(event.id, STATUS.QUOTED, {
    status: STATUS.APPROVED,
    approved_at: new Date(),
    reviewed_by: req.account.accountId,
    reviewed_at: new Date(),
  });
  if (!updated) return res.status(409).json({ message: 'Event is no longer QUOTED', code: 'EVENT_NOT_QUOTED' });

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_APPROVED, updated, {});
  res.json(updated);
}

// POST /api/private-events/:id/confirm (privateEvent.review) — PAID -> CONFIRMED.
async function confirmEvent(req, res) {
  const event = req.privateEvent;
  if (event.status !== STATUS.PAID) {
    return res.status(409).json({ message: `Event is ${event.status}, not PAID`, code: 'EVENT_NOT_PAID' });
  }

  const updated = await privateEventRepository.transitionEvent(event.id, STATUS.PAID, {
    status: STATUS.CONFIRMED,
    confirmed_at: new Date(),
  });
  if (!updated) return res.status(409).json({ message: 'Event is no longer PAID', code: 'EVENT_NOT_PAID' });

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_CONFIRMED, updated, {});
  res.json(updated);
}

// POST /api/private-events/:id/complete (privateEvent.review) — CONFIRMED -> COMPLETED.
async function completeEvent(req, res) {
  const event = req.privateEvent;
  if (event.status !== STATUS.CONFIRMED) {
    return res.status(409).json({ message: `Event is ${event.status}, not CONFIRMED`, code: 'EVENT_NOT_CONFIRMED' });
  }

  const updated = await privateEventRepository.transitionEvent(event.id, STATUS.CONFIRMED, {
    status: STATUS.COMPLETED,
    completed_at: new Date(),
  });
  if (!updated) return res.status(409).json({ message: 'Event is no longer CONFIRMED', code: 'EVENT_NOT_CONFIRMED' });

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_COMPLETED, updated, {});
  res.json(updated);
}

// POST /api/private-events/:id/reject (privateEvent.review) — cancel/reject anything that
// has not COMPLETED yet. { reason? }
async function rejectEvent(req, res) {
  const event = req.privateEvent;
  if (event.status === STATUS.COMPLETED || event.status === STATUS.CANCELLED) {
    return res.status(409).json({ message: `A ${event.status} event cannot be cancelled`, code: 'EVENT_NOT_CANCELLABLE' });
  }

  const updated = await privateEventRepository.transitionEvent(
    event.id,
    PrivateEvent.STATUSES.filter((s) => s !== STATUS.COMPLETED && s !== STATUS.CANCELLED),
    {
      status: STATUS.CANCELLED,
      cancelled_at: new Date(),
      cancel_reason: strOr(req.body.reason) || 'Cancelled by branch',
      reviewed_by: req.account.accountId,
      reviewed_at: new Date(),
    },
  );
  if (!updated) return res.status(409).json({ message: 'Event can no longer be cancelled', code: 'EVENT_NOT_CANCELLABLE' });

  await auditBranch(req, AuditLog.ACTION.PRIVATE_EVENT_CANCELLED, updated, { by: 'ADMIN', reason: updated.cancel_reason });
  res.json(updated);
}

// ---- Event packages ---------------------------------------------

// GET /api/event-packages?status=&page=&limit= (eventPackage.read) — the rental catalogue.
async function listPackages(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.status && EventPackage.STATUSES.includes(req.query.status)) filter.status = req.query.status;
  const { data, total } = await privateEventRepository.findPackages(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/event-packages/:id (eventPackage.read)
async function getPackage(req, res) {
  const pkg = await privateEventRepository.findPackageById(req.params.id);
  if (!pkg) return res.status(404).json({ message: 'Event package not found' });
  res.json(pkg);
}

// POST /api/event-packages (eventPackage.manage — SUPER_ADMIN)
// { name, code, base_price, description?, max_guests?, duration_hours?, perks?, status? }
async function createPackage(req, res) {
  const name = strOr(req.body.name);
  const code = strOr(req.body.code).toUpperCase();
  if (!name || !code) return res.status(400).json({ message: 'name and code are required' });

  const priceError = validateNonNegative(req.body.base_price, 'base_price');
  if (priceError) return res.status(400).json(priceError);
  const numErr = validatePackageNumbers(req.body);
  if (numErr) return res.status(400).json(numErr);
  const statusErr = validateEnum(req.body.status, EventPackage.STATUSES);
  if (statusErr) return res.status(400).json(statusErr);

  if (await privateEventRepository.findPackageByCode(code)) {
    return res.status(409).json({ message: 'A package with that code already exists', code: 'PACKAGE_CODE_TAKEN' });
  }

  const id = await nextId('eventPackage');
  const pkg = await privateEventRepository.createPackage({
    id,
    name,
    code,
    description: strOr(req.body.description),
    base_price: Number(req.body.base_price),
    max_guests: req.body.max_guests === undefined ? 0 : Number(req.body.max_guests),
    duration_hours: req.body.duration_hours === undefined ? 0 : Number(req.body.duration_hours),
    perks: Array.isArray(req.body.perks) ? req.body.perks.map((p) => String(p).trim()).filter(Boolean) : [],
    status: req.body.status || 'ACTIVE',
  });
  res.status(201).json(pkg);
}

// PUT /api/event-packages/:id (eventPackage.manage). `code` may change but must stay unique.
async function updatePackage(req, res) {
  const pkg = await privateEventRepository.findPackageById(req.params.id);
  if (!pkg) return res.status(404).json({ message: 'Event package not found' });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = strOr(req.body.name);
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.code !== undefined) {
    const code = strOr(req.body.code).toUpperCase();
    if (!code) return res.status(400).json({ message: 'code cannot be empty' });
    if (await privateEventRepository.findPackageByCode(code, { excludeId: pkg.id })) {
      return res.status(409).json({ message: 'A package with that code already exists', code: 'PACKAGE_CODE_TAKEN' });
    }
    updates.code = code;
  }
  if (req.body.description !== undefined) updates.description = strOr(req.body.description);
  if (req.body.base_price !== undefined) {
    const priceError = validateNonNegative(req.body.base_price, 'base_price');
    if (priceError) return res.status(400).json(priceError);
    updates.base_price = Number(req.body.base_price);
  }
  const numErr = validatePackageNumbers(req.body);
  if (numErr) return res.status(400).json(numErr);
  if (req.body.max_guests !== undefined) updates.max_guests = Number(req.body.max_guests);
  if (req.body.duration_hours !== undefined) updates.duration_hours = Number(req.body.duration_hours);
  if (req.body.perks !== undefined) {
    updates.perks = Array.isArray(req.body.perks) ? req.body.perks.map((p) => String(p).trim()).filter(Boolean) : [];
  }
  if (req.body.status !== undefined) {
    const statusErr = validateEnum(req.body.status, EventPackage.STATUSES);
    if (statusErr) return res.status(400).json(statusErr);
    updates.status = req.body.status;
  }

  const updated = await privateEventRepository.updatePackage(pkg.id, updates);
  res.json(updated);
}

// DELETE /api/event-packages/:id (eventPackage.manage) — refused while any event references it
// (the historical record would lose its package).
async function removePackage(req, res) {
  const pkg = await privateEventRepository.findPackageById(req.params.id);
  if (!pkg) return res.status(404).json({ message: 'Event package not found' });

  if ((await privateEventRepository.countEventsForPackage(pkg.id)) > 0) {
    return res.status(409).json({
      message: 'This package is used by existing events — set it INACTIVE instead',
      code: 'PACKAGE_IN_USE',
    });
  }

  await privateEventRepository.removePackage(pkg.id);
  res.json({ message: 'Deleted' });
}

// ---- helpers -----------------------------------------------------

function strOr(raw, fallback = '') {
  return raw === undefined || raw === null ? fallback : String(raw).trim();
}

function validateNonNegative(raw, field) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { message: `${field} must be a non-negative number`, code: 'INVALID_NUMBER' };
  }
  return null;
}

function validatePackageNumbers(body) {
  for (const field of ['max_guests', 'duration_hours']) {
    if (body[field] === undefined) continue;
    const n = Number(body[field]);
    if (!Number.isFinite(n) || n < 0) {
      return { message: `${field} must be a non-negative number`, code: 'INVALID_NUMBER' };
    }
  }
  return null;
}

function validateEnum(raw, allowed) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!allowed.includes(raw)) {
    return { message: `status must be one of ${allowed.join(', ')}`, code: 'INVALID_VALUE' };
  }
  return null;
}

module.exports = {
  // customer
  requestEvent,
  listMine,
  payEvent,
  cancelOwnEvent,
  // admin
  listEvents,
  getEvent,
  quoteEvent,
  approveEvent,
  confirmEvent,
  completeEvent,
  rejectEvent,
  // packages
  listPackages,
  getPackage,
  createPackage,
  updatePackage,
  removePackage,
  // exported for tests
  checkRoomAvailability,
};
