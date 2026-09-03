const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const boxOfficeController = require('./boxOffice.controller');
const comboOrderController = require('./comboOrder.controller');
const refundController = require('./refund.controller');
const cashierShiftController = require('./cashierShift.controller');
const cashierShiftRepository = require('../repositories/cashierShift.repository');
const cashierShiftService = require('../services/cashierShift.service');
const CashierShift = require('../models/CashierShift');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Combo = require('../models/Combo');
const ComboOrder = require('../models/ComboOrder');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Refund = require('../models/Refund');
const Employee = require('../models/Employee');

// How a cash transaction actually gets attributed to a drawer, end to end: the sale/refund
// paths stamp the acting cashier's OPEN shift, the reconciliation adds up exactly those rows,
// and a settled shift accepts nothing further.

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const BRANCH_ID = 5;
const CASHIER_ACCOUNT = 7;
const OTHER_CASHIER_ACCOUNT = 8;
const CUSTOMER_ACCOUNT = 1;

beforeAll(async () => {
  await connect();
  await CashierShift.init();
});
let logSpy;
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  await Branch.create({ id: BRANCH_ID, company_id: 1, owner_id: 99, name: 'C1', code: 'A' });
  await Room.create({ id: 1, cinema_id: BRANCH_ID, name: 'R1' });
  await Schedule.create({
    id: 1,
    movie_id: 1,
    room_id: 1,
    movie_date: '2026-01-01',
    time_begin: '10:00',
    time_end: '12:00',
    price: 100000,
  });
  await Account.create({ id: CUSTOMER_ACCOUNT, email: 'a@b.com', password: 'x' });
  await Employee.create([
    { id: 1, user_id: CASHIER_ACCOUNT, branch_id: BRANCH_ID, employee_code: 'EMP-1', position_id: 1, status: 1 },
    { id: 2, user_id: OTHER_CASHIER_ACCOUNT, branch_id: BRANCH_ID, employee_code: 'EMP-2', position_id: 1, status: 1 },
  ]);
});
afterEach(async () => {
  await clearDatabase();
  logSpy.mockRestore();
});
afterAll(async () => closeDatabase());

function openDrawer(accountId = CASHIER_ACCOUNT, employeeId = 1, openingCash = 500000) {
  return cashierShiftRepository.open({
    employeeId,
    accountId,
    branchId: BRANCH_ID,
    openingCash,
    openedBy: accountId,
  });
}

async function heldSeat(id, seatIndex, heldBy = CASHIER_ACCOUNT) {
  return Ticket.create({ id, schedule_id: 1, seat_index: seatIndex, seat_code: `A${id}`, status: 2, held_by: heldBy });
}

async function sell({ ticketIds, comboIds = [], method = 'CASH', accountId = CASHIER_ACCOUNT }) {
  const res = mockRes();
  await boxOfficeController.sellTickets(
    {
      body: { scheduleId: 1, ticketIds, comboIds, accountId: CUSTOMER_ACCOUNT, method },
      headers: {},
      account: { accountId },
      branchId: BRANCH_ID,
    },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(201);
  return res.json.mock.calls[0][0];
}

async function reconcile(shiftId) {
  return cashierShiftService.computeReconciliation(await cashierShiftRepository.findById(shiftId));
}

describe('box office sale attribution', () => {
  it('stamps a cash sale with the seller’s open drawer and counts it as cash sales', async () => {
    const shift = await openDrawer();
    await heldSeat(1, 0);

    const payload = await sell({ ticketIds: [1] });

    expect((await Payment.findOne({ code: payload.code })).shift_id).toBe(shift.id);
    expect(await reconcile(shift.id)).toMatchObject({
      cashSales: 100000,
      cashRefunds: 0,
      expectedCash: 600000,
    });
  });

  it('stamps a card sale too, but keeps it out of the cash total', async () => {
    const shift = await openDrawer();
    await heldSeat(1, 0);

    const payload = await sell({ ticketIds: [1], method: 'CARD' });

    expect((await Payment.findOne({ code: payload.code })).shift_id).toBe(shift.id);
    expect(await reconcile(shift.id)).toMatchObject({ cashSales: 0, expectedCash: 500000 });
  });

  it('leaves a sale unattributed when the seller has no drawer open, without blocking it', async () => {
    await heldSeat(1, 0);
    const payload = await sell({ ticketIds: [1] });

    expect((await Booking.findOne({ code: payload.code })).status).toBe('PAID');
    expect((await Payment.findOne({ code: payload.code })).shift_id).toBeNull();
  });

  it('never attributes a new sale to a shift the cashier has already closed', async () => {
    const shift = await openDrawer();
    await cashierShiftRepository.close(shift.id, {
      cashSales: 0,
      cashRefunds: 0,
      expectedCash: 500000,
      actualCash: 500000,
      difference: 0,
      closedBy: CASHIER_ACCOUNT,
    });
    await heldSeat(1, 0);

    const payload = await sell({ ticketIds: [1] });

    expect((await Payment.findOne({ code: payload.code })).shift_id).toBeNull();
    // The settled figures stand.
    expect(await reconcile(shift.id)).toMatchObject({ cashSales: 0, expectedCash: 500000, live: false });
  });

  it('keeps each cashier’s takings in their own drawer', async () => {
    const mine = await openDrawer(CASHIER_ACCOUNT, 1);
    const theirs = await openDrawer(OTHER_CASHIER_ACCOUNT, 2);
    await heldSeat(1, 0, CASHIER_ACCOUNT);
    await heldSeat(2, 1, OTHER_CASHIER_ACCOUNT);

    await sell({ ticketIds: [1], accountId: CASHIER_ACCOUNT });
    await sell({ ticketIds: [2], accountId: OTHER_CASHIER_ACCOUNT });

    expect((await reconcile(mine.id)).cashSales).toBe(100000);
    expect((await reconcile(theirs.id)).cashSales).toBe(100000);
  });

  // A combo bought alongside tickets is already inside the booking's Payment.amount, so its
  // ComboOrder must stay unstamped or the same cash would be counted twice.
  it('counts a combo sold with tickets once, through the booking’s payment only', async () => {
    const shift = await openDrawer();
    await Combo.create({ id: 1, cinema_id: BRANCH_ID, name: 'Popcorn', price: 60000 });
    await heldSeat(1, 0);

    const payload = await sell({ ticketIds: [1], comboIds: [1] });

    const linkedOrder = await ComboOrder.findOne({ booking_id: (await Booking.findOne({ code: payload.code })).id });
    expect(linkedOrder.total_price).toBe(60000);
    expect(linkedOrder.shift_id).toBeNull();

    const reconciliation = await reconcile(shift.id);
    expect(reconciliation.ticketCash).toBe(160000); // 100000 seat + 60000 combo, one payment
    expect(reconciliation.comboCash).toBe(0);
    expect(reconciliation.cashSales).toBe(160000);
  });
});

describe('counter combo sale attribution', () => {
  async function createPendingOrder(id = 1) {
    return ComboOrder.create({
      id,
      code: `CO-${id}`,
      branch_id: BRANCH_ID,
      items: [{ combo_id: 1, name: 'Popcorn', unit_price: 60000, quantity: 1, line_total: 60000 }],
      total_price: 60000,
      status: 'PENDING',
      created_by: CASHIER_ACCOUNT,
    });
  }

  function payOrder(orderId, accountId = CASHIER_ACCOUNT, method = 'CASH') {
    const res = mockRes();
    return comboOrderController
      .payOrder(
        { params: { id: orderId }, body: { method }, account: { accountId }, permissionScope: 'ALL' },
        res,
      )
      .then(() => res);
  }

  function cancelOrder(orderId, accountId = CASHIER_ACCOUNT) {
    const res = mockRes();
    return comboOrderController
      .cancelOrder(
        { params: { id: orderId }, body: { reason: 'customer changed their mind' }, account: { accountId }, permissionScope: 'ALL' },
        res,
      )
      .then(() => res);
  }

  it('stamps a cash-paid counter order with the drawer and counts it', async () => {
    const shift = await openDrawer();
    await createPendingOrder();

    await payOrder(1);

    expect((await ComboOrder.findOne({ id: 1 })).shift_id).toBe(shift.id);
    expect(await reconcile(shift.id)).toMatchObject({ comboCash: 60000, cashSales: 60000, expectedCash: 560000 });
  });

  it('stamps a MoMo-paid order but keeps it out of the cash total', async () => {
    const shift = await openDrawer();
    await createPendingOrder();

    await payOrder(1, CASHIER_ACCOUNT, 'MOMO');

    expect((await ComboOrder.findOne({ id: 1 })).shift_id).toBe(shift.id);
    expect((await reconcile(shift.id)).cashSales).toBe(0);
  });

  it('drops an order cancelled while the drawer is still open — the cash went back over the counter', async () => {
    const shift = await openDrawer();
    await createPendingOrder();
    await payOrder(1);
    expect((await reconcile(shift.id)).cashSales).toBe(60000);

    const res = await cancelOrder(1);
    expect(res.status).not.toHaveBeenCalledWith(409);
    expect((await ComboOrder.findOne({ id: 1 })).status).toBe('CANCELLED');
    expect(await reconcile(shift.id)).toMatchObject({ cashSales: 0, expectedCash: 500000 });
  });

  // "Không cho sửa giao dịch sau khi Shift đã đóng"
  it('refuses to cancel an order paid in a shift that has already been reconciled', async () => {
    const shift = await openDrawer();
    await createPendingOrder();
    await payOrder(1);
    await cashierShiftRepository.close(shift.id, {
      cashSales: 60000,
      cashRefunds: 0,
      expectedCash: 560000,
      actualCash: 560000,
      difference: 0,
      closedBy: CASHIER_ACCOUNT,
    });

    const res = await cancelOrder(1);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SHIFT_CLOSED' }));
    expect((await ComboOrder.findOne({ id: 1 })).status).toBe('PAID');
  });

  it('still allows cancelling an order that belongs to no shift at all', async () => {
    await createPendingOrder();
    await payOrder(1);
    expect((await ComboOrder.findOne({ id: 1 })).shift_id).toBeNull();

    const res = await cancelOrder(1);
    expect(res.status).not.toHaveBeenCalledWith(409);
    expect((await ComboOrder.findOne({ id: 1 })).status).toBe('CANCELLED');
  });
});

describe('cash refund attribution', () => {
  async function seedRefundableBooking({ method }) {
    await Booking.create({
      id: 1,
      code: 'CTR-1',
      account_id: CUSTOMER_ACCOUNT,
      schedule_id: 1,
      branch_id: BRANCH_ID,
      ticket_ids: [1],
      total_price: 100000,
      status: 'PAID',
      paid_at: new Date(),
    });
    await Payment.create({
      id: 1,
      code: 'CTR-1',
      booking_id: 1,
      account_id: CUSTOMER_ACCOUNT,
      branch_id: BRANCH_ID,
      type: 'COUNTER',
      method,
      amount: 100000,
      status: 'PAID',
      paid_at: new Date(),
    });
    await Invoice.create({
      id: 1,
      code: 'CTR-1',
      booking_id: 1,
      ticket_id: 1,
      account_id: CUSTOMER_ACCOUNT,
      total_price: 100000,
    });
    return Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: CUSTOMER_ACCOUNT,
      branch_id: BRANCH_ID,
      amount: 40000,
      policy_percent: 40,
      status: 'PROCESSING',
      processed_by: CASHIER_ACCOUNT,
    });
  }

  function complete(accountId = CASHIER_ACCOUNT) {
    const res = mockRes();
    return refundController
      .completeRefund({ params: { id: 1 }, body: {}, account: { accountId }, permissionScope: 'ALL' }, res)
      .then(() => res);
  }

  it('takes a cash refund out of the drawer that is open when it is paid', async () => {
    const shift = await openDrawer();
    await seedRefundableBooking({ method: 'CASH' });

    await complete();

    expect((await Refund.findOne({ id: 1 })).shift_id).toBe(shift.id);
    expect(await reconcile(shift.id)).toMatchObject({
      cashSales: 0,
      cashRefunds: 40000,
      expectedCash: 460000, // 500000 float - 40000 paid back
    });
  });

  it('leaves a card refund unattributed — it never touches a till', async () => {
    const shift = await openDrawer();
    await seedRefundableBooking({ method: 'CARD' });

    await complete();

    expect((await Refund.findOne({ id: 1 })).shift_id).toBeNull();
    expect((await reconcile(shift.id)).cashRefunds).toBe(0);
  });

  it('charges the refund to the drawer that is open now, not the one the sale happened in', async () => {
    const original = await openDrawer();
    await seedRefundableBooking({ method: 'CASH' });
    await Payment.updateOne({ id: 1 }, { $set: { shift_id: original.id } });
    await cashierShiftRepository.close(original.id, {
      cashSales: 100000,
      cashRefunds: 0,
      expectedCash: 600000,
      actualCash: 600000,
      difference: 0,
      closedBy: CASHIER_ACCOUNT,
    });

    const today = await openDrawer(CASHIER_ACCOUNT, 1, 200000);
    await complete();

    expect((await Refund.findOne({ id: 1 })).shift_id).toBe(today.id);
    // Yesterday's settled count is untouched...
    expect(await reconcile(original.id)).toMatchObject({ cashRefunds: 0, expectedCash: 600000, live: false });
    // ...and today's drawer is down by the payout.
    expect(await reconcile(today.id)).toMatchObject({ cashRefunds: 40000, expectedCash: 160000 });
  });
});

describe('closing a shift after a day of trading', () => {
  it('settles against every stamped transaction and freezes the result', async () => {
    const shift = await openDrawer();
    await Combo.create({ id: 1, cinema_id: BRANCH_ID, name: 'Popcorn', price: 60000 });
    await heldSeat(1, 0);
    await heldSeat(2, 1);
    await sell({ ticketIds: [1] }); // 100000 cash
    await sell({ ticketIds: [2], method: 'CARD' }); // not cash
    await ComboOrder.create({
      id: 1,
      code: 'CO-1',
      branch_id: BRANCH_ID,
      items: [{ combo_id: 1, name: 'Popcorn', unit_price: 60000, quantity: 1, line_total: 60000 }],
      total_price: 60000,
      status: 'PENDING',
      created_by: CASHIER_ACCOUNT,
    });
    const payRes = mockRes();
    await comboOrderController.payOrder(
      { params: { id: 1 }, body: { method: 'CASH' }, account: { accountId: CASHIER_ACCOUNT }, permissionScope: 'ALL' },
      payRes,
    );
    await Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: CUSTOMER_ACCOUNT,
      branch_id: BRANCH_ID,
      amount: 25000,
      policy_percent: 25,
      status: 'COMPLETED',
      shift_id: shift.id,
    });

    const res = mockRes();
    await cashierShiftController.closeShift(
      {
        params: { id: shift.id },
        body: { actual_cash: 630000 },
        account: { accountId: CASHIER_ACCOUNT },
        permissionScope: 'OWN',
      },
      res,
    );

    const [closed] = res.json.mock.calls[0];
    expect(closed).toMatchObject({
      status: 'CLOSED',
      cash_sales: 160000, // 100000 ticket cash + 60000 combo cash (the card sale is excluded)
      cash_refunds: 25000,
      expected_cash: 635000, // 500000 + 160000 - 25000
      actual_cash: 630000,
      difference: -5000,
    });

    // Post-close, the frozen numbers are what everyone reads.
    expect(await reconcile(shift.id)).toMatchObject({ expectedCash: 635000, difference: -5000, live: false });
  });
});
