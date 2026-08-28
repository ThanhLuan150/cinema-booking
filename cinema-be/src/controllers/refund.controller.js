const refundRepository = require('../repositories/refund.repository');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const auditLogRepository = require('../repositories/auditLog.repository');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const { calculateRefundAmount } = require('../utils/refundPolicy');
const systemConfigService = require('../services/systemConfig.service');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const notificationService = require('../services/notification.service');

// OWN: caller must own the refund's booking. BRANCH: caller must have access to the refund's
// branch. ALL: no restriction. Same shape as canAccessBooking/canAccessPayment. Used for
// read-only access (viewing a refund's status).
async function canAccessRefund(req, refund) {
  if (req.permissionScope === 'ALL') return true;
  if (req.permissionScope === 'OWN') return refund.account_id === req.account.accountId;
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    return branchIds.includes(refund.branch_id);
  }
  return false;
}

// Approve/reject/process/complete/fail are staff-only decisions on someone else's money — a
// customer must never be able to action their own refund request just because they "own" it.
// OWN scope is deliberately excluded here even though RBAC never grants a customer the
// refund.approve/refund.process permission in the first place; this is the controller-level
// backstop in case that ever changes.
async function canManageRefund(req, refund) {
  if (req.permissionScope === 'ALL') return true;
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    return branchIds.includes(refund.branch_id);
  }
  return false;
}

function hoursUntil(schedule) {
  const showtime = new Date(`${schedule.movie_date}T${schedule.time_begin}:00`);
  return (showtime.getTime() - Date.now()) / (1000 * 60 * 60);
}

// POST /api/refunds { booking_id, reason } -> customer requests a refund for their own booking.
// Every check below runs against server-held state; the only thing taken from the request body
// is the customer's free-text reason — the refund amount is always computed here, never
// accepted from the client.
async function requestRefund(req, res) {
  const { booking_id, reason } = req.body || {};
  if (!booking_id) return res.status(400).json({ message: 'booking_id is required' });

  const booking = await bookingRepository.findBookingById(booking_id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  // Booking ownership: OWN scope may only request a refund for their own booking.
  if (req.permissionScope === 'OWN' && booking.account_id !== req.account.accountId) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    if (!branchIds.includes(booking.branch_id)) return res.status(403).json({ message: 'Forbidden' });
  }

  if (booking.status !== Booking.STATUS.PAID) {
    return res.status(400).json({
      message: `A refund can only be requested for a PAID booking (current status: ${booking.status})`,
      code: 'BOOKING_NOT_REFUNDABLE',
    });
  }

  const existingActive = await refundRepository.findActiveByBookingId(booking.id);
  if (existingActive) {
    return res.status(409).json({ message: 'A refund is already in progress for this booking', code: 'REFUND_ALREADY_REQUESTED' });
  }

  // Payment must have actually succeeded.
  const payment = await paymentRepository.findByCode(booking.code);
  if (!payment || payment.status !== Payment.STATUS.PAID) {
    return res.status(400).json({
      message: 'This booking has no successful payment to refund',
      code: 'PAYMENT_NOT_PAID',
    });
  }

  // Ticket status: none of the booking's tickets may already be used/cancelled/refunded/expired.
  const invoices = await Invoice.find({ booking_id: booking.id });
  const notIssued = invoices.find((inv) => inv.ticket_status !== Invoice.TICKET_STATUS.ISSUED);
  if (notIssued) {
    return res.status(400).json({
      message: `This booking has a ticket that is already ${notIssued.ticket_status.toLowerCase()} and cannot be refunded`,
      code: 'TICKET_NOT_REFUNDABLE',
    });
  }

  // Showtime timing + cancellation policy: the refund percentage/amount is derived solely
  // from how far away the showtime is, never from anything the client sent.
  const schedule = await bookingRepository.findScheduleById(booking.schedule_id);
  if (!schedule) return res.status(400).json({ message: 'Unable to resolve this booking\'s showtime' });

  // Ticket 27: REFUND_POLICY, resolved for the booking's own branch (falls back to the
  // hardcoded REFUND_TIERS default when nothing has been configured).
  const tiers = await systemConfigService.getValue('REFUND_POLICY', booking.branch_id ?? null);
  const { percent, amount, eligible } = calculateRefundAmount({
    totalPrice: booking.total_price,
    hoursUntilShowtime: hoursUntil(schedule),
    tiers,
  });
  if (!eligible) {
    return res.status(400).json({
      message: 'This booking is too close to its showtime to be eligible for a refund',
      code: 'REFUND_WINDOW_EXPIRED',
    });
  }

  const refund = await refundRepository.createRefund({
    bookingId: booking.id,
    paymentId: payment.id,
    accountId: booking.account_id,
    branchId: booking.branch_id,
    amount,
    policyPercent: percent,
    reason: reason || null,
    requestedBy: req.account.accountId,
  });

  await auditLogRepository.create({
    entityType: 'REFUND',
    entityId: refund.id,
    branchId: refund.branch_id,
    action: AuditLog.ACTION.REFUND_REQUESTED,
    performedBy: req.account.accountId,
    reason: reason || null,
    metadata: { bookingId: booking.id, amount, policyPercent: percent },
  });

  res.status(201).json(refund);
}

// GET /api/refunds/my -> the caller's own refund requests, newest first
async function myRefunds(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await refundRepository.listForAccount(req.account.accountId, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/refunds?status=&page=&limit= -> refunds visible to the caller, scoped by
// refund.read's OWN/BRANCH/ALL
async function listRefunds(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.permissionScope === 'OWN') {
    filter.account_id = req.account.accountId;
  } else if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    filter.branch_id = { $in: branchIds };
  }
  if (req.query.status) filter.status = req.query.status;
  // Lets branch/all-scoped staff (e.g. Customer Service) pull up one customer's refunds; OWN
  // scope already forces account_id above, so this would only narrow it to themselves anyway.
  if (req.query.accountId && req.permissionScope !== 'OWN') filter.account_id = Number(req.query.accountId);

  const { data, total } = await refundRepository.listAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/refunds/:id
async function getRefundById(req, res) {
  const refund = await refundRepository.findById(req.params.id);
  if (!refund) return res.status(404).json({ message: 'Refund not found' });
  if (!(await canAccessRefund(req, refund))) return res.status(403).json({ message: 'Forbidden' });
  res.json(refund);
}

// POST /api/refunds/:id/approve { note } -> REQUESTED -> APPROVED (staff decision)
async function approveRefund(req, res) {
  const refund = await refundRepository.findById(req.params.id);
  if (!refund) return res.status(404).json({ message: 'Refund not found' });
  if (!(await canManageRefund(req, refund))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await refundRepository.approve(refund.id, {
    decidedBy: req.account.accountId,
    decisionReason: req.body?.note || null,
  });
  if (!updated) {
    return res.status(400).json({
      message: `Only a REQUESTED refund can be approved (current status: ${refund.status})`,
      code: 'REFUND_NOT_REQUESTED',
    });
  }

  await auditLogRepository.create({
    entityType: 'REFUND',
    entityId: refund.id,
    branchId: refund.branch_id,
    action: AuditLog.ACTION.REFUND_APPROVED,
    performedBy: req.account.accountId,
  });
  res.json(updated);
}

// POST /api/refunds/:id/reject { reason } -> REQUESTED -> REJECTED (staff decision)
async function rejectRefund(req, res) {
  const { reason } = req.body || {};
  if (!reason) return res.status(400).json({ message: 'reason is required' });

  const refund = await refundRepository.findById(req.params.id);
  if (!refund) return res.status(404).json({ message: 'Refund not found' });
  if (!(await canManageRefund(req, refund))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await refundRepository.reject(refund.id, { decidedBy: req.account.accountId, decisionReason: reason });
  if (!updated) {
    return res.status(400).json({
      message: `Only a REQUESTED refund can be rejected (current status: ${refund.status})`,
      code: 'REFUND_NOT_REQUESTED',
    });
  }

  await auditLogRepository.create({
    entityType: 'REFUND',
    entityId: refund.id,
    branchId: refund.branch_id,
    action: AuditLog.ACTION.REFUND_REJECTED,
    performedBy: req.account.accountId,
    reason,
  });
  res.json(updated);
}

// POST /api/refunds/:id/process -> APPROVED -> PROCESSING (staff hands the refund off to be paid out)
async function processRefund(req, res) {
  const refund = await refundRepository.findById(req.params.id);
  if (!refund) return res.status(404).json({ message: 'Refund not found' });
  if (!(await canManageRefund(req, refund))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await refundRepository.markProcessing(refund.id, { processedBy: req.account.accountId });
  if (!updated) {
    return res.status(400).json({
      message: `Only an APPROVED refund can be processed (current status: ${refund.status})`,
      code: 'REFUND_NOT_APPROVED',
    });
  }

  await auditLogRepository.create({
    entityType: 'REFUND',
    entityId: refund.id,
    branchId: refund.branch_id,
    action: AuditLog.ACTION.REFUND_PROCESSING,
    performedBy: req.account.accountId,
  });
  res.json(updated);
}

// POST /api/refunds/:id/complete -> PROCESSING -> COMPLETED. Marks the Payment refunded and
// releases the booking's tickets/invoices, same effect the old ad-hoc payment refund flow had.
async function completeRefund(req, res) {
  const refund = await refundRepository.findById(req.params.id);
  if (!refund) return res.status(404).json({ message: 'Refund not found' });
  if (!(await canManageRefund(req, refund))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await refundRepository.complete(refund.id);
  if (!updated) {
    return res.status(400).json({
      message: `Only a PROCESSING refund can be completed (current status: ${refund.status})`,
      code: 'REFUND_NOT_PROCESSING',
    });
  }

  await paymentRepository.markRefunded(refund.payment_id, req.account.accountId);
  const booking = await bookingRepository.findBookingById(refund.booking_id);
  if (booking) await bookingRepository.applyRefund(booking);

  await auditLogRepository.create({
    entityType: 'REFUND',
    entityId: refund.id,
    branchId: refund.branch_id,
    action: AuditLog.ACTION.REFUND_COMPLETED,
    performedBy: req.account.accountId,
    metadata: { amount: refund.amount },
  });
  // Canonical Ticket-24 action: the money actually went back. Kept alongside the fine-grained
  // REFUND_COMPLETED state row so audit-log consumers can filter on a single `REFUND` action.
  await auditLogRepository.create({
    entityType: 'REFUND',
    entityId: refund.id,
    branchId: refund.branch_id,
    action: AuditLog.ACTION.REFUND,
    performedBy: req.account.accountId,
    metadata: { bookingId: refund.booking_id, amount: refund.amount },
  });
  // Ticket 25: notify the customer the money actually went back.
  if (booking) {
    await notificationService.notify({
      event: notificationService.EVENT.REFUND_COMPLETED,
      accountId: booking.account_id,
      bookingId: refund.booking_id,
      data: { amount: refund.amount },
      channels: [notificationService.CHANNEL.IN_APP, notificationService.CHANNEL.EMAIL],
    });
  }
  res.json(updated);
}

// POST /api/refunds/:id/fail { reason } -> PROCESSING -> FAILED (e.g. the payout attempt bounced)
async function failRefund(req, res) {
  const { reason } = req.body || {};
  if (!reason) return res.status(400).json({ message: 'reason is required' });

  const refund = await refundRepository.findById(req.params.id);
  if (!refund) return res.status(404).json({ message: 'Refund not found' });
  if (!(await canManageRefund(req, refund))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await refundRepository.fail(refund.id, { failureReason: reason });
  if (!updated) {
    return res.status(400).json({
      message: `Only a PROCESSING refund can be marked failed (current status: ${refund.status})`,
      code: 'REFUND_NOT_PROCESSING',
    });
  }

  await auditLogRepository.create({
    entityType: 'REFUND',
    entityId: refund.id,
    branchId: refund.branch_id,
    action: AuditLog.ACTION.REFUND_FAILED,
    performedBy: req.account.accountId,
    reason,
  });
  res.json(updated);
}

module.exports = {
  canAccessRefund,
  canManageRefund,
  requestRefund,
  myRefunds,
  listRefunds,
  getRefundById,
  approveRefund,
  rejectRefund,
  processRefund,
  completeRefund,
  failRefund,
};
