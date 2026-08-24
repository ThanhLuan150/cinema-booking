const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const paymentController = require('./payment.controller');
const paymentRepository = require('../repositories/payment.repository');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Branch = require('../models/Branch');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('GET /api/payments/my', () => {
  it('returns only the caller\'s own payments', async () => {
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000,
    });
    await paymentRepository.createPayment({
      code: 'BK-2', bookingId: 2, accountId: 2, type: 'ONLINE', method: 'MOMO', amount: 2000,
    });
    const res = mockRes();
    await paymentController.myPayments({ query: {}, account: { accountId: 1 } }, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].code).toBe('BK-1');
  });
});

describe('GET /api/payments (admin)', () => {
  it('BRANCH scope only returns payments for the caller\'s accessible branches', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 7, name: 'C1', code: 'A' });
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, branchId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000,
    });
    await paymentRepository.createPayment({
      code: 'BK-2', bookingId: 2, accountId: 2, branchId: 2, type: 'ONLINE', method: 'MOMO', amount: 2000,
    });
    const res = mockRes();
    await paymentController.adminPayments(
      { query: {}, account: { accountId: 7 }, permissionScope: 'BRANCH' },
      res,
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].branch_id).toBe(1);
  });

  it('filters by status and type', async () => {
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000, status: 'PAID',
    });
    await paymentRepository.createPayment({
      code: 'BK-2', bookingId: 2, accountId: 1, type: 'COUNTER', method: 'CASH', amount: 2000, status: 'PAID',
    });
    const res = mockRes();
    await paymentController.adminPayments(
      { query: { type: 'COUNTER' }, account: { accountId: 7 }, permissionScope: 'ALL' },
      res,
    );
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].code).toBe('BK-2');
  });
});

describe('GET /api/payments/:code/status', () => {
  it('returns 404 when the payment does not exist', async () => {
    const res = mockRes();
    await paymentController.getPaymentStatus({ params: { code: 'NOPE' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids OWN scope from reading another account\'s payment', async () => {
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000,
    });
    const res = mockRes();
    await paymentController.getPaymentStatus(
      { params: { code: 'BK-1' }, account: { accountId: 2 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns the payment for its own account', async () => {
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000,
    });
    const res = mockRes();
    await paymentController.getPaymentStatus(
      { params: { code: 'BK-1' }, account: { accountId: 1 }, permissionScope: 'OWN' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BK-1', status: 'PENDING' }));
  });
});

describe('refund lifecycle', () => {
  async function seedPaidBooking() {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    const booking = await Booking.create({
      id: 1, code: 'BK-1', account_id: 1, schedule_id: 1, branch_id: 1,
      ticket_ids: [1], total_price: 1000, status: 'PAID',
    });
    await Invoice.create({ id: 1, booking_id: booking.id, ticket_id: 1, account_id: 1, code: 'BK-1', total_price: 1000, status: 1 });
    const payment = await paymentRepository.createPayment({
      code: 'BK-1', bookingId: booking.id, accountId: 1, branchId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000, status: 'PAID',
    });
    return { booking, payment };
  }

  it('returns 404 when the payment does not exist', async () => {
    const res = mockRes();
    await paymentController.requestRefund({ params: { id: 999 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects requesting a refund on a payment that is not PAID', async () => {
    await paymentRepository.createPayment({
      code: 'BK-1', bookingId: 1, accountId: 1, type: 'ONLINE', method: 'MOMO', amount: 1000,
    });
    const res = mockRes();
    await paymentController.requestRefund(
      { params: { id: 1 }, body: {}, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAYMENT_NOT_REFUNDABLE' }));
  });

  it('moves a PAID payment to REFUND_PENDING', async () => {
    const { payment } = await seedPaidBooking();
    const res = mockRes();
    await paymentController.requestRefund(
      { params: { id: payment.id }, body: { reason: 'Customer changed plans' }, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUND_PENDING' }));
  });

  it('rejects confirming a refund with no pending request', async () => {
    const { payment } = await seedPaidBooking();
    const res = mockRes();
    await paymentController.confirmRefund(
      { params: { id: payment.id }, account: { accountId: 1 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REFUND_NOT_PENDING' }));
  });

  it('confirms a pending refund, reopens the seat and marks the invoice refunded', async () => {
    const { payment } = await seedPaidBooking();
    await paymentRepository.requestRefund(payment.id, 'Customer changed plans');

    const res = mockRes();
    await paymentController.confirmRefund(
      { params: { id: payment.id }, account: { accountId: 9 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'REFUNDED', refunded_by: 9 }));

    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(1);
    const invoice = await Invoice.findOne({ id: 1 });
    expect(invoice.status).toBe(2);
    const booking = await Booking.findOne({ id: 1 });
    expect(booking.status).toBe('CANCELLED');
  });

  it('forbids a BRANCH-scoped caller without access to the payment\'s branch', async () => {
    await Branch.create({ id: 2, company_id: 1, owner_id: 55, name: 'Other', code: 'X' });
    const { payment } = await seedPaidBooking(); // branch_id: 1
    const res = mockRes();
    await paymentController.requestRefund(
      { params: { id: payment.id }, body: {}, account: { accountId: 55 }, permissionScope: 'BRANCH' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
