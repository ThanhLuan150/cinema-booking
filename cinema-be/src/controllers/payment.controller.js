const paymentRepository = require('../repositories/payment.repository');
const bookingRepository = require('../repositories/booking.repository');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

async function canAccessPayment(req, payment) {
  if (req.permissionScope === 'ALL') return true;
  if (req.permissionScope === 'OWN') return payment.account_id === req.account.accountId;
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    return branchIds.includes(payment.branch_id);
  }
  return false;
}

// GET /api/payments/my -> the caller's own payment history, newest first
async function myPayments(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await paymentRepository.listForAccount(req.account.accountId, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/payments?status=&type=&page=&limit() -> payments visible to the caller, scoped by
async function adminPayments(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    filter.branch_id = { $in: branchIds };
  } else if (req.permissionScope === 'OWN') {
    filter.account_id = req.account.accountId;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  // Lets branch/all-scoped staff (e.g. Customer Service) pull up one customer's payments; OWN
  // scope already forces account_id above, so this would only narrow it to themselves anyway.
  if (req.query.accountId && req.permissionScope !== 'OWN') filter.account_id = Number(req.query.accountId);

  const { data, total } = await paymentRepository.listAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/payments/:code/status -> verify a single payment's current lifecycle status
async function getPaymentStatus(req, res) {
  const payment = await paymentRepository.findByCode(req.params.code);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (!(await canAccessPayment(req, payment))) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(payment);
}

// POST /api/payments/:id/refund/request { reason } -> PAID -> REFUND_PENDING
async function requestRefund(req, res) {
  const payment = await paymentRepository.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (!(await canAccessPayment(req, payment))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const updated = await paymentRepository.requestRefund(payment.id, req.body?.reason || null);
  if (!updated) {
    return res.status(400).json({
      message: `Only a PAID payment can be refunded (current status: ${payment.status})`,
      code: 'PAYMENT_NOT_REFUNDABLE',
    });
  }
  res.json(updated);
}

// POST /api/payments/:id/refund/confirm -> REFUND_PENDING -> REFUNDED, releases the booking's
// seats back to AVAILABLE and marks its Invoice rows refunded.
async function confirmRefund(req, res) {
  const payment = await paymentRepository.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (!(await canAccessPayment(req, payment))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const updated = await paymentRepository.completeRefund(payment.id, req.account.accountId);
  if (!updated) {
    return res.status(400).json({
      message: 'This payment has no refund request pending confirmation',
      code: 'REFUND_NOT_PENDING',
    });
  }

  const booking = await bookingRepository.findBookingById(updated.booking_id);
  if (booking) await bookingRepository.applyRefund(booking);

  await recordAudit({
    req,
    action: ACTION.REFUND,
    entityType: ENTITY_TYPE.PAYMENT,
    entityId: updated.id,
    branchId: updated.branch_id ?? null,
    metadata: { code: updated.code, bookingId: updated.booking_id, amount: updated.amount },
  });

  res.json(updated);
}

module.exports = {
  myPayments,
  adminPayments,
  getPaymentStatus,
  requestRefund,
  confirmRefund,
};
