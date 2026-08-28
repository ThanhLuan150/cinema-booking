const deviceRepository = require('../repositories/device.repository');
const entranceRepository = require('../repositories/entrance.repository');
const checkinLogRepository = require('../repositories/checkinLog.repository');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const Device = require('../models/Device');
const nextId = require('../utils/nextId');
const { generateDeviceKey, hashDeviceKey } = require('../utils/deviceKey');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');
const systemConfigService = require('../services/systemConfig.service');

const STATUSES = Device.STATUSES;

// entrance_id, when supplied, must be a real entrance of the device's own branch.
async function resolveEntranceId(entranceIdRaw, branchId) {
  if (entranceIdRaw === undefined || entranceIdRaw === null || entranceIdRaw === '') return { entranceId: null };
  const entrance = await entranceRepository.findById(entranceIdRaw);
  if (!entrance || entrance.branch_id !== branchId) return { error: true };
  return { entranceId: entrance.id };
}

// GET /api/devices?branchId=&status=&entranceId=&page=&limit= (device.read, branch-scoped)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.entranceId) filter.entrance_id = Number(req.query.entranceId);

  const { data, total } = await deviceRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/devices/:id (device.read, branch-scoped)
async function getById(req, res) {
  const device = await deviceRepository.findById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  res.json(device);
}

// POST /api/devices { branch_id, device_id, name, entrance_id?, status? } (device.create,
// branch-scoped). Returns the generated api_key exactly once — it is never retrievable later.
async function create(req, res) {
  const branch_id = req.branchId;
  const device_id = req.body.device_id ? String(req.body.device_id).trim() : '';
  const name = req.body.name ? String(req.body.name).trim() : '';
  if (!device_id || !name) return res.status(400).json({ message: 'device_id and name are required' });

  if (await deviceRepository.findByDeviceId(device_id)) {
    return res.status(409).json({ message: 'A device with this device_id already exists', code: 'DEVICE_ID_TAKEN' });
  }

  const { entranceId, error } = await resolveEntranceId(req.body.entrance_id, branch_id);
  if (error) return res.status(400).json({ message: 'entrance_id must belong to the same branch', code: 'ENTRANCE_BRANCH_MISMATCH' });

  let status = 'ACTIVE';
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    status = req.body.status;
  }

  const apiKey = generateDeviceKey();
  const id = await nextId('device');
  const device = await deviceRepository.create({
    id,
    device_id,
    name,
    branch_id,
    entrance_id: entranceId,
    status,
    api_key_hash: hashDeviceKey(apiKey),
  });

  res.status(201).json({ ...device.toJSON(), api_key: apiKey });
}

// PUT /api/devices/:id { name?, entrance_id?, status? } (device.update, branch-scoped). The
// branch and device_id are immutable — move a scanner by deleting and re-registering it so its
// check-in history stays coherent.
async function update(req, res) {
  const device = await deviceRepository.findById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.entrance_id !== undefined) {
    const { entranceId, error } = await resolveEntranceId(req.body.entrance_id, device.branch_id);
    if (error) return res.status(400).json({ message: 'entrance_id must belong to the same branch', code: 'ENTRANCE_BRANCH_MISMATCH' });
    updates.entrance_id = entranceId;
  }
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updates.status = req.body.status;
  }

  const updated = await deviceRepository.updateFields(device.id, updates);
  res.json(updated);
}

// POST /api/devices/:id/rotate-key (device.update, branch-scoped) — invalidates the old key and
// returns a fresh one once. Use when a key is believed compromised or a unit is redeployed.
async function rotateKey(req, res) {
  const device = await deviceRepository.findById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });

  const apiKey = generateDeviceKey();
  await deviceRepository.updateFields(device.id, { api_key_hash: hashDeviceKey(apiKey) });
  res.json({ api_key: apiKey });
}

// DELETE /api/devices/:id (device.delete, branch-scoped). CheckinLog rows keep the numeric
// device_id for the audit trail even after the device record is gone.
async function remove(req, res) {
  const device = await deviceRepository.findById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  await deviceRepository.remove(device.id);
  res.json({ message: 'Deleted' });
}

// GET /api/devices/logs?branchId=&deviceId=&entranceId=&result=&page=&limit= (device.read,
// branch-scoped by the route's resolveListAccess).
async function listLogs(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.deviceId) filter.device_id = Number(req.query.deviceId);
  if (req.query.entranceId) filter.entrance_id = Number(req.query.entranceId);
  if (req.query.result && ['SUCCESS', 'REJECTED'].includes(req.query.result)) filter.result = req.query.result;

  const { data, total } = await checkinLogRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/devices/checkin { qr_token } — authenticated by the X-Device-Key header
// (requireDevice -> req.device), NOT a user JWT. Enforces the ticket-23 security rule: a scanner
// registered to one branch can never admit a ticket issued by another branch. Every attempt,
// admitted or refused, is written to CheckinLog.
async function checkin(req, res) {
  const device = req.device;
  const { qr_token } = req.body;

  const logBase = {
    device_id: device.id,
    entrance_id: device.entrance_id ?? null,
    branch_id: device.branch_id,
    qr_token: qr_token ?? null,
    checked_in_by: null,
  };
  const reject = async (httpStatus, reason, message) => {
    await checkinLogRepository.record({ ...logBase, result: 'REJECTED', reason }).catch(() => {});
    return res.status(httpStatus).json({ message, code: reason });
  };

  if (!qr_token) return res.status(400).json({ message: 'qr_token is required', code: 'QR_TOKEN_REQUIRED' });

  const resolved = await bookingRepository.findTicketViewByQrToken(qr_token);
  if (!resolved) return reject(404, 'TICKET_NOT_FOUND', 'Invalid or unknown QR code');

  const { view, invoice } = resolved;

  // The security rule: reject a ticket that does not belong to this scanner's branch.
  if (view.branch_id !== device.branch_id) {
    return reject(403, 'BRANCH_MISMATCH', 'This ticket belongs to a different branch');
  }

  const payment = await paymentRepository.findByCode(invoice.code);
  if (!payment || payment.status !== 'PAID') {
    return reject(400, 'PAYMENT_NOT_PAID', 'Payment for this ticket has not been completed');
  }

  if (invoice.ticket_status === 'USED') return reject(409, 'ALREADY_CHECKED_IN', 'This ticket has already been checked in');
  if (invoice.ticket_status === 'CANCELLED') return reject(400, 'TICKET_CANCELLED', 'This ticket has been cancelled');
  if (invoice.ticket_status === 'REFUNDED') return reject(400, 'TICKET_REFUNDED', 'This ticket has been refunded');
  if (invoice.ticket_status === 'EXPIRED') return reject(400, 'TICKET_EXPIRED', 'This ticket has expired');

  const ticket = await bookingRepository.findTicketById(invoice.ticket_id);
  const schedule = ticket ? await bookingRepository.findScheduleById(ticket.schedule_id) : null;
  if (!schedule || schedule.status !== 'ACTIVE') {
    return reject(400, 'SHOWTIME_INVALID', 'This showtime is no longer valid');
  }

  const movie = await bookingRepository.findMovieById(schedule.movie_id);
  const earlyMinutes = await systemConfigService.getValue('CHECKIN_BEFORE_SHOWTIME', device.branch_id);
  const { opensAt, closesAt } = bookingRepository.getShowtimeCheckinWindow(schedule, movie, earlyMinutes);
  const now = Date.now();
  if (now < opensAt) return reject(400, 'CHECKIN_TOO_EARLY', 'Check-in has not opened yet for this showtime');
  if (now > closesAt) return reject(400, 'CHECKIN_TOO_LATE', 'Check-in has closed for this showtime');

  const updated = await bookingRepository.checkInInvoiceRecord({
    id: invoice.id,
    accountId: null,
    branchId: device.branch_id,
  });
  if (!updated) return reject(409, 'ALREADY_CHECKED_IN', 'This ticket has already been checked in');

  await bookingRepository.maybeCompleteBooking(updated.booking_id);
  await checkinLogRepository
    .record({ ...logBase, result: 'SUCCESS', reason: null, invoice_id: invoice.id })
    .catch(() => {});

  await recordAudit({
    performedBy: null,
    action: ACTION.TICKET_CHECKIN,
    entityType: ENTITY_TYPE.TICKET,
    entityId: invoice.id,
    branchId: device.branch_id ?? null,
    metadata: { invoice_code: updated.code, channel: 'DEVICE', device_id: device.id },
  });

  res.json({
    checked_in: true,
    invoice_id: updated.id,
    code: updated.code,
    seat_code: view.seat_code,
    movie: view.movie ? view.movie.name : null,
    schedule: view.schedule,
  });
}

module.exports = { list, getById, create, update, rotateKey, remove, listLogs, checkin };
