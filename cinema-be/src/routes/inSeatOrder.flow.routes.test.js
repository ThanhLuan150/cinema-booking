// Ticket 49 end to end, over HTTP:
//   Customer scans the seat QR -> selects combos -> pays (MoMo) -> KDS NEW -> PREPARING -> READY ->
//   COMPLETED (delivered to the seat), plus every way the money can go wrong.
jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed
jest.mock('../utils/mailer', () =>
  Object.fromEntries(
    Object.keys(jest.requireActual('../utils/mailer')).map((name) => [name, jest.fn().mockResolvedValue({})]),
  ),
);

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, auth, qrFor, seedInSeatWorld } = require('../../tests/inSeatFixtures');
const { errorHandler } = require('../middleware/errorHandler');
const inSeatOrderRoutes = require('./inSeatOrder.routes');
const kdsRoutes = require('./kds.routes');
const bookingRoutes = require('./booking.routes');
const paymentRoutes = require('./payment.routes');
const inSeatOrderService = require('../services/inSeatOrder.service');
const reportingRepository = require('../repositories/reporting.repository');
const customerCrmService = require('../services/customerCrm.service');
const socket = require('../utils/socket');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const ComboOrder = require('../models/ComboOrder');
const Inventory = require('../models/Inventory');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');

const app = express();
app.use(express.json());
app.use('/api/in-seat', inSeatOrderRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api', bookingRoutes);
app.use('/api', paymentRoutes);
app.use(errorHandler);

const ORIGINAL_ENV = process.env;
let logSpy;
let errorSpy;
beforeAll(async () => connect());
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...ORIGINAL_ENV };
  for (const key of ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY', 'MOMO_INSEAT_REDIRECT_URL']) {
    delete process.env[key];
  }
  await seedInSeatWorld();
  // Lan's ticket booking was paid online (its own Payment) — the baseline revenue.
  await Payment.create({
    id: 900,
    code: 'BK-100',
    booking_id: ID.LAN_BOOKING,
    account_id: ID.LAN,
    branch_id: ID.BRANCH_1,
    type: 'ONLINE',
    method: 'MOMO',
    amount: 90000,
    status: 'PAID',
    paid_at: new Date(),
  });
  await Inventory.create({ id: 1, branch_id: ID.BRANCH_1, combo_id: ID.POPCORN, item: 'Large Popcorn', quantity: 10 });
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
  logSpy.mockRestore();
  errorSpy.mockRestore();
});
afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await closeDatabase();
});

async function placeOrder(items = [{ combo_id: ID.POPCORN, quantity: 2 }, { combo_id: ID.COKE, quantity: 1 }]) {
  const res = await request(app)
    .post('/api/in-seat/orders')
    .set('Authorization', auth.lan())
    .send({ qr: qrFor(), items });
  expect(res.status).toBe(201);
  return res.body.order;
}

// What MoMo appends to the redirect URL (and posts to the IPN).
function momoResult(code, { resultCode = 0, transId = `TX-${code}` } = {}) {
  return {
    partnerCode: 'MOMO',
    orderId: code,
    requestId: `REQ-${code}`,
    amount: '160000',
    orderInfo: `In-seat order ${code}`,
    orderType: 'momo_wallet',
    transId,
    resultCode: String(resultCode),
    message: resultCode === 0 ? 'Successful.' : 'Transaction denied by user.',
    payType: 'qr',
    responseTime: '1759450000000',
    extraData: '',
  };
}

const confirm = (code, body, header = auth.lan()) =>
  request(app).post(`/api/in-seat/orders/${code}/momo-confirm`).set('Authorization', header).send(body);
const board = (header = auth.fnb1(), branchId = ID.BRANCH_1) =>
  request(app).get(`/api/kds/branches/${branchId}/orders`).set('Authorization', header);
const move = (orderId, status, extra = {}, header = auth.fnb1()) =>
  request(app)
    .patch(`/api/kds/branches/${ID.BRANCH_1}/orders/${orderId}/status`)
    .set('Authorization', header)
    .send({ status, ...extra });

describe('Ticket 49 flow — scan, select, pay, KDS, prepare, deliver to seat, completed', () => {
  it('a paid in-seat order reaches the KDS with its seat, and F&B Staff deliver it', async () => {
    const placed = await placeOrder();

    const paid = await confirm(placed.code, momoResult(placed.code));
    expect(paid.status).toBe(200);
    expect(paid.body).toEqual(expect.objectContaining({ success: true, already_processed: false, refund_pending: false }));
    expect(paid.body.order).toEqual(
      expect.objectContaining({ status: 'PAID', payment: { status: 'PAID', method: 'MOMO', amount: 160000 } }),
    );
    expect(paid.body.order.pay_url).toBeNull(); // nothing left to pay

    const payment = await Payment.findOne({ code: placed.code });
    expect(payment.status).toBe('PAID');
    expect(payment.gateway_transaction_id).toBe(`TX-${placed.code}`);
    // Stock taken once, at payment.
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(8);
    // Announced to the branch (live KDS) and to the customer's own screen.
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(
      ID.BRANCH_1,
      'comboOrder:updated',
      expect.objectContaining({ code: placed.code, status: 'PAID' }),
    );
    expect(socket.emitToAccount).toHaveBeenCalledWith(
      ID.LAN,
      'comboOrder:updated',
      expect.objectContaining({ code: placed.code, status: 'PAID' }),
    );
    const audit = await AuditLog.findOne({ action: 'PAYMENT_SUCCESS', entity_id: payment.id });
    expect(audit.metadata).toEqual(expect.objectContaining({ code: placed.code, channel: 'IN_SEAT', amount: 160000 }));

    const kds = await board();
    expect(kds.body.orders).toHaveLength(1);
    const [card] = kds.body.orders;
    expect(card).toEqual(
      expect.objectContaining({
        code: placed.code,
        status: 'NEW',
        channel: 'IN_SEAT',
        customer: { id: ID.LAN, name: 'Lan Nguyen' },
        delivery: {
          type: 'SEAT',
          seat: 'E7',
          room: 'Hall 3',
          showtime: expect.objectContaining({ date: expect.any(String), time: expect.any(String) }),
        },
      }),
    );
    expect(JSON.stringify(card)).not.toMatch(/price|total|amount/); // the kitchen never sees money

    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      const step = await move(card.id, status);
      expect(step.status).toBe(200);
      expect(step.body.status).toBe(status);
    }

    const tracked = await request(app).get(`/api/in-seat/orders/${placed.code}`).set('Authorization', auth.lan());
    expect(tracked.body.status).toBe('DELIVERED');
    for (const field of ['paid_at', 'prepared_at', 'ready_at', 'delivered_at']) {
      expect(tracked.body[field]).toBeTruthy();
    }
    expect(tracked.body.total_price).toBe(160000); // never touched by the kitchen
  });

  it('keeps the order on its own branch kitchen: another branch cannot see or move it', async () => {
    const placed = await placeOrder();
    await confirm(placed.code, momoResult(placed.code));
    const stored = await ComboOrder.findOne({ code: placed.code });

    expect((await board(auth.fnb2())).status).toBe(403); // branch 2 staff on branch 1's KDS
    const branch2Board = await board(auth.fnb2(), ID.BRANCH_2);
    expect(branch2Board.body.orders).toEqual([]);
    const crossMove = await request(app)
      .patch(`/api/kds/branches/${ID.BRANCH_2}/orders/${stored.id}/status`)
      .set('Authorization', auth.fnb2())
      .send({ status: 'PREPARING' });
    expect(crossMove.status).toBe(403);
    expect(crossMove.body.code).toBe('KDS_BRANCH_MISMATCH');
  });

  it('is idempotent: a repeated confirm (or MoMo retry) changes nothing and takes stock once', async () => {
    const placed = await placeOrder();
    await confirm(placed.code, momoResult(placed.code));
    const again = await confirm(placed.code, momoResult(placed.code));
    expect(again.status).toBe(200);
    expect(again.body.already_processed).toBe(true);
    expect(again.body.order.status).toBe('PAID');
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(8);
    expect(await AuditLog.countDocuments({ action: 'PAYMENT_SUCCESS' })).toBe(1);
  });

  it('stock that ran out between ordering and paying never strands a customer who has already paid', async () => {
    const placed = await placeOrder(); // 2 popcorn, 10 in stock at the time
    await Inventory.updateOne({ id: 1 }, { $set: { quantity: 1 } }); // the counter sold the rest meanwhile
    const res = await confirm(placed.code, momoResult(placed.code));
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('PAID'); // in the kitchen queue all the same
    expect((await Payment.findOne({ code: placed.code })).status).toBe('PAID');
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(0); // floored, never negative
  });

  it('the MoMo IPN (shared with ticket bookings) is routed to the in-seat order by its Payment type', async () => {
    const placed = await placeOrder();
    const res = await request(app).post('/api/MomoPayment/ipn').send(momoResult(placed.code));
    expect(res.status).toBe(200);
    expect(res.body.resultCode).toBe(0);
    expect((await ComboOrder.findOne({ code: placed.code })).status).toBe('PAID');
    expect((await Payment.findOne({ code: placed.code })).status).toBe('PAID');
    // The ticket-booking finalizer never ran for it: no ticket invoices were issued under this code.
    expect(await Invoice.countDocuments({ code: placed.code })).toBe(0);
  });

  it('the legacy /MomoPayment/confirm cannot leave an in-seat order paid-but-unpaid, nor confirm another account', async () => {
    const placed = await placeOrder();
    const stranger = await request(app)
      .post('/api/MomoPayment/confirm')
      .set('Authorization', auth.minh())
      .send(momoResult(placed.code));
    expect(stranger.status).toBe(403);
    expect((await Payment.findOne({ code: placed.code })).status).toBe('PENDING');

    const owner = await request(app)
      .post('/api/MomoPayment/confirm')
      .set('Authorization', auth.lan())
      .send(momoResult(placed.code));
    expect(owner.status).toBe(200);
    expect((await ComboOrder.findOne({ code: placed.code })).status).toBe('PAID');
  });
});

describe('Ticket 49 — payment failures and authorization of the payment step', () => {
  it('a failed payment cancels the order: it never reaches the kitchen and takes no stock', async () => {
    const placed = await placeOrder();
    const res = await confirm(placed.code, momoResult(placed.code, { resultCode: 1006 }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.order.status).toBe('CANCELLED');
    expect((await Payment.findOne({ code: placed.code })).status).toBe('FAILED');
    expect((await board()).body.orders).toEqual([]);
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(10);
    expect(await AuditLog.countDocuments({ action: 'PAYMENT_FAILED' })).toBe(1);
  });

  it('refuses a forged MoMo result when signatures are enforced', async () => {
    process.env.MOMO_SECRET_KEY = 'secret';
    process.env.MOMO_ACCESS_KEY = 'access';
    const placed = await placeOrder();
    const forged = { ...momoResult(placed.code), signature: 'forged' };
    const res = await confirm(placed.code, forged);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PAYMENT_SIGNATURE_INVALID');
    expect((await ComboOrder.findOne({ code: placed.code })).status).toBe('PENDING');

    const params = momoResult(placed.code);
    const raw =
      `accessKey=access&amount=${params.amount}&extraData=${params.extraData}&message=${params.message}` +
      `&orderId=${params.orderId}&orderInfo=${params.orderInfo}&orderType=${params.orderType}` +
      `&partnerCode=${params.partnerCode}&payType=${params.payType}&requestId=${params.requestId}` +
      `&responseTime=${params.responseTime}&resultCode=${params.resultCode}&transId=${params.transId}`;
    const signature = crypto.createHmac('sha256', 'secret').update(raw).digest('hex');
    const genuine = await confirm(placed.code, { ...params, signature });
    expect(genuine.status).toBe(200);
    expect(genuine.body.order.status).toBe('PAID');
  });

  it("refuses a result for another order, and confirming someone else's order", async () => {
    const placed = await placeOrder();
    const mismatch = await confirm(placed.code, momoResult('CO-999'));
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.code).toBe('PAYMENT_ORDER_MISMATCH');

    const stranger = await confirm(placed.code, momoResult(placed.code), auth.minh());
    expect(stranger.status).toBe(404);
    expect((await ComboOrder.findOne({ code: placed.code })).status).toBe('PENDING');
  });

  it('an unpaid order lapses after the payment window; a late MoMo success is flagged for refund, not kept', async () => {
    const placed = await placeOrder();
    await ComboOrder.updateOne({ code: placed.code }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    expect(await inSeatOrderService.expireStalePendingOrders()).toBe(1);
    expect((await ComboOrder.findOne({ code: placed.code })).status).toBe('CANCELLED');
    expect(await inSeatOrderService.expireStalePendingOrders()).toBe(0); // nothing left to sweep

    const late = await request(app).post('/api/MomoPayment/ipn').send(momoResult(placed.code));
    expect(late.status).toBe(200);
    const payment = await Payment.findOne({ code: placed.code });
    expect(payment.status).toBe('REFUND_PENDING');
    expect(payment.refund_reason).toMatch(/no longer awaiting payment/);
    expect((await ComboOrder.findOne({ code: placed.code })).status).toBe('CANCELLED');
    expect((await board()).body.orders).toEqual([]);
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(10);
  });

  it('the sweep leaves paid and still-valid orders alone', async () => {
    const pending = await placeOrder();
    const paid = await placeOrder([{ combo_id: ID.COKE, quantity: 1 }]);
    await confirm(paid.code, momoResult(paid.code));
    await ComboOrder.updateOne({ code: paid.code }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    expect(await inSeatOrderService.expireStalePendingOrders()).toBe(0);
    expect((await ComboOrder.findOne({ code: pending.code })).status).toBe('PENDING');
    expect((await ComboOrder.findOne({ code: paid.code })).status).toBe('PAID');
  });
});

describe('Ticket 49 — cancelling a paid in-seat order gives the money back, never the tickets', () => {
  it('a KDS cancel flags the MoMo payment for refund; confirming it leaves the seat booking untouched', async () => {
    const placed = await placeOrder();
    await confirm(placed.code, momoResult(placed.code));
    const stored = await ComboOrder.findOne({ code: placed.code });

    const cancelled = await move(stored.id, 'CANCELLED', { reason: 'Popcorn machine down' });
    expect(cancelled.status).toBe(200);
    const payment = await Payment.findOne({ code: placed.code });
    expect(payment.status).toBe('REFUND_PENDING');
    expect(payment.refund_reason).toContain('Popcorn machine down');
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(10); // restocked

    const refunded = await request(app)
      .post(`/api/payments/${payment.id}/refund/confirm`)
      .set('Authorization', auth.superAdmin());
    expect(refunded.status).toBe(200);
    expect(refunded.body.status).toBe('REFUNDED');

    // The customer still has their seat: booking, ticket and seat untouched.
    expect((await Booking.findOne({ id: ID.LAN_BOOKING })).status).toBe('PAID');
    expect((await Invoice.findOne({ id: ID.LAN_INVOICE })).ticket_status).toBe('ISSUED');
    expect((await Ticket.findOne({ id: 1 })).status).toBe(Ticket.STATUS.BOOKED);
    expect((await Payment.findOne({ code: 'BK-100' })).status).toBe('PAID');
  });
});

describe('Ticket 49 — revenue is counted exactly once', () => {
  it('the in-seat food is combo revenue on its own; the seat booking is not counted a second time', async () => {
    const placed = await placeOrder();
    await confirm(placed.code, momoResult(placed.code));

    const breakdown = await reportingRepository.getRevenueBreakdown({ branchIds: [ID.BRANCH_1] });
    expect(breakdown).toEqual(
      expect.objectContaining({ ticketRevenue: 90000, comboRevenue: 160000, netRevenue: 250000 }),
    );
    const byDay = await reportingRepository.getRevenueByDay({ branchIds: [ID.BRANCH_1] });
    expect(byDay.reduce((sum, day) => sum + day.total, 0)).toBe(250000);
    const byBranch = await reportingRepository.getRevenueByBranch({});
    expect(byBranch.find((row) => row.branchId === ID.BRANCH_1).netRevenue).toBe(250000);

    const profile = await customerCrmService.buildCustomerProfile({ accountId: ID.LAN });
    expect(profile.total_combo_spending).toBe(160000);
    expect(profile.total_spending).toBe(250000);
  });

  it('an unpaid or cancelled in-seat order earns nothing', async () => {
    await placeOrder(); // never paid
    const cancelled = await placeOrder([{ combo_id: ID.COKE, quantity: 1 }]);
    await confirm(cancelled.code, momoResult(cancelled.code, { resultCode: 1006 }));
    const breakdown = await reportingRepository.getRevenueBreakdown({ branchIds: [ID.BRANCH_1] });
    expect(breakdown.comboRevenue).toBe(0);
    expect(breakdown.netRevenue).toBe(90000);
  });
});
