const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const refundController = require('./refund.controller');
const refundRepository = require('../repositories/refund.repository');
const paymentRepository = require('../repositories/payment.repository');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Branch = require('../models/Branch');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function showtimeParts(hoursFromNow) {
  const dt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const movie_date = dt.toISOString().split('T')[0];
  const time_begin = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return { movie_date, time_begin };
}

// Seeds a fully paid booking (1 seat) whose showtime is `hoursFromNow` away, with a matching
// PAID payment and an ISSUED invoice — the baseline state a refund can legally be requested
// against. Each field can be overridden to exercise a specific rejection path.
async function seedPaidBooking({
  hoursFromNow = 48,
  totalPrice = 200000,
  bookingStatus = Booking.STATUS.PAID,
  paymentStatus = Payment.STATUS.PAID,
  ticketStatus = Invoice.TICKET_STATUS.ISSUED,
  accountId = 1,
  branchId = 1,
} = {}) {
  const { movie_date, time_begin } = showtimeParts(hoursFromNow);
  await Schedule.create({
    id: 1, movie_id: 1, room_id: 1, cinema_id: branchId, movie_date, time_begin, time_end: '23:59', price: 100000,
  });
  await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
  const booking = await Booking.create({
    id: 1, code: 'BK-1', account_id: accountId, schedule_id: 1, branch_id: branchId,
    ticket_ids: [1], total_price: totalPrice, status: bookingStatus,
  });
  await Invoice.create({
    id: 1, booking_id: booking.id, ticket_id: 1, account_id: accountId, code: 'BK-1',
    total_price: totalPrice, status: 1, ticket_status: ticketStatus,
  });
  const payment = await paymentRepository.createPayment({
    code: 'BK-1', bookingId: booking.id, accountId, branchId, type: 'ONLINE', method: 'MOMO',
    amount: totalPrice, status: paymentStatus,
  });
  return { booking, payment };
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('POST /api/refunds (requestRefund) — authorization', () => {
  it('returns 404 when the booking does not exist', async () => {
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: 999 }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids OWN scope from requesting a refund for another account\'s booking', async () => {
    const { booking } = await seedPaidBooking({ accountId: 1 });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 2 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids BRANCH scope without access to the booking\'s branch', async () => {
    await Branch.create({ id: 9, company_id: 1, owner_id: 55, name: 'Other', code: 'X' });
    const { booking } = await seedPaidBooking({ branchId: 1 });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 55 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows the booking\'s own account under OWN scope', async () => {
    const { booking } = await seedPaidBooking({ accountId: 1, hoursFromNow: 48 });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('POST /api/refunds (requestRefund) — eligibility checks', () => {
  it('rejects a booking that is not PAID', async () => {
    const { booking } = await seedPaidBooking({ bookingStatus: Booking.STATUS.CANCELLED });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BOOKING_NOT_REFUNDABLE' }));
  });

  it('rejects when the payment never succeeded', async () => {
    const { booking } = await seedPaidBooking({ paymentStatus: Payment.STATUS.PENDING });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAYMENT_NOT_PAID' }));
  });

  it('rejects when a ticket has already been used', async () => {
    const { booking } = await seedPaidBooking({ ticketStatus: Invoice.TICKET_STATUS.USED });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TICKET_NOT_REFUNDABLE' }));
  });

  it('rejects a showtime inside the 2h cancellation window', async () => {
    const { booking } = await seedPaidBooking({ hoursFromNow: 1 });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFUND_WINDOW_EXPIRED' }));
  });

  it('rejects a duplicate request while one is already in progress', async () => {
    const { booking } = await seedPaidBooking({ hoursFromNow: 48 });
    const first = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      first,
    );
    expect(first.status).toHaveBeenCalledWith(201);

    const second = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      second,
    );
    expect(second.status).toHaveBeenCalledWith(409);
    expect(second.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFUND_ALREADY_REQUESTED' }));
  });
});

describe('POST /api/refunds (requestRefund) — amount calculation', () => {
  it('computes 100% of total_price for a showtime >= 24h away', async () => {
    const { booking } = await seedPaidBooking({ hoursFromNow: 48, totalPrice: 200000 });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id, reason: 'change of plans' }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ amount: 200000, policy_percent: 100, status: 'REQUESTED' }));
  });

  it('computes 50% of total_price for a showtime between 2h and 24h away', async () => {
    const { booking } = await seedPaidBooking({ hoursFromNow: 10, totalPrice: 200000 });
    const res = mockRes();
    await refundController.requestRefund(
      { body: { booking_id: booking.id }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ amount: 100000, policy_percent: 50 }));
  });

  it('ignores any amount the client sends and always uses the server-computed figure', async () => {
    const { booking } = await seedPaidBooking({ hoursFromNow: 48, totalPrice: 200000 });
    const res = mockRes();
    await refundController.requestRefund(
      {
        body: { booking_id: booking.id, amount: 999999999, policy_percent: 999 },
        account: { accountId: 1 },
        permissionScope: 'OWN',
      },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ amount: 200000, policy_percent: 100 }));
  });
});

describe('Refund staff decision lifecycle — authorization', () => {
  async function seedRequestedRefund(overrides = {}) {
    const { booking, payment } = await seedPaidBooking({ hoursFromNow: 48, branchId: 1, ...overrides });
    const refund = await refundRepository.createRefund({
      bookingId: booking.id, paymentId: payment.id, accountId: booking.account_id, branchId: booking.branch_id,
      amount: 200000, policyPercent: 100, reason: null, requestedBy: booking.account_id,
    });
    return { booking, payment, refund };
  }

  it('forbids a customer (OWN scope) from approving their own refund request', async () => {
    const { refund } = await seedRequestedRefund();
    const res = mockRes();
    await refundController.approveRefund(
      { params: { id: refund.id }, account: { accountId: refund.account_id }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids a BRANCH-scoped staffer without access to the refund\'s branch', async () => {
    await Branch.create({ id: 9, company_id: 1, owner_id: 77, name: 'Other', code: 'X' });
    const { refund } = await seedRequestedRefund({ branchId: 1 });
    const res = mockRes();
    await refundController.approveRefund(
      { params: { id: refund.id }, account: { accountId: 77 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows ALL scope to approve regardless of branch', async () => {
    const { refund } = await seedRequestedRefund();
    const res = mockRes();
    await refundController.approveRefund(
      { params: { id: refund.id }, body: {}, account: { accountId: 999 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED' }));
  });
});

describe('Refund status-machine transitions', () => {
  async function seedRefundAt(status, overrides = {}) {
    const { booking, payment } = await seedPaidBooking({ hoursFromNow: 48, ...overrides });
    const refund = await refundRepository.createRefund({
      bookingId: booking.id, paymentId: payment.id, accountId: booking.account_id, branchId: booking.branch_id,
      amount: 200000, policyPercent: 100, reason: null, requestedBy: booking.account_id,
    });
    if (status === 'APPROVED' || status === 'PROCESSING' || status === 'COMPLETED' || status === 'FAILED') {
      await refundRepository.approve(refund.id, { decidedBy: 9 });
    }
    if (status === 'PROCESSING' || status === 'COMPLETED' || status === 'FAILED') {
      await refundRepository.markProcessing(refund.id, { processedBy: 9 });
    }
    return { booking, payment, refund };
  }

  it('rejects rejecting a refund with no reason', async () => {
    const { refund } = await seedRefundAt('REQUESTED');
    const res = mockRes();
    await refundController.rejectRefund(
      { params: { id: refund.id }, body: {}, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a REQUESTED refund, leaving the booking untouched', async () => {
    const { refund, booking } = await seedRefundAt('REQUESTED');
    const res = mockRes();
    await refundController.rejectRefund(
      { params: { id: refund.id }, body: { reason: 'Not eligible' }, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'REJECTED' }));
    expect((await Booking.findOne({ id: booking.id })).status).toBe('PAID');
  });

  it('cannot process a refund that has not been approved yet', async () => {
    const { refund } = await seedRefundAt('REQUESTED');
    const res = mockRes();
    await refundController.processRefund(
      { params: { id: refund.id }, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFUND_NOT_APPROVED' }));
  });

  it('moves an APPROVED refund to PROCESSING', async () => {
    const { refund } = await seedRefundAt('APPROVED');
    const res = mockRes();
    await refundController.processRefund(
      { params: { id: refund.id }, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PROCESSING' }));
  });

  it('cannot complete a refund that is not PROCESSING', async () => {
    const { refund } = await seedRefundAt('APPROVED');
    const res = mockRes();
    await refundController.completeRefund(
      { params: { id: refund.id }, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFUND_NOT_PROCESSING' }));
  });

  it('completing a PROCESSING refund marks the payment refunded and releases the ticket/booking', async () => {
    const { refund, booking, payment } = await seedRefundAt('PROCESSING');
    const res = mockRes();
    await refundController.completeRefund(
      { params: { id: refund.id }, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));

    expect((await Payment.findOne({ id: payment.id })).status).toBe('REFUNDED');
    expect((await Ticket.findOne({ id: 1 })).status).toBe(1);
    const invoice = await Invoice.findOne({ booking_id: booking.id });
    expect(invoice.ticket_status).toBe('REFUNDED');
    expect((await Booking.findOne({ id: booking.id })).status).toBe('CANCELLED');
  });

  it('failing a PROCESSING refund requires a reason and leaves booking/payment untouched', async () => {
    const { refund, booking, payment } = await seedRefundAt('PROCESSING');

    const missingReason = mockRes();
    await refundController.failRefund(
      { params: { id: refund.id }, body: {}, account: { accountId: 9 }, permissionScope: 'ALL' },
      missingReason,
    );
    expect(missingReason.status).toHaveBeenCalledWith(400);

    const res = mockRes();
    await refundController.failRefund(
      { params: { id: refund.id }, body: { reason: 'Gateway timeout' }, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED', failure_reason: 'Gateway timeout' }));
    expect((await Payment.findOne({ id: payment.id })).status).toBe('PAID');
    expect((await Booking.findOne({ id: booking.id })).status).toBe('PAID');
  });
});
