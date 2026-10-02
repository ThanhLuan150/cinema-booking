const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const kdsService = require('./kds.service');
const comboOrderRepository = require('../repositories/comboOrder.repository');
const ComboOrder = require('../models/ComboOrder');
const Account = require('../models/Account');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const items = [
  { combo_id: 1, name: 'Popcorn Combo', unit_price: 50000, quantity: 2, line_total: 100000 },
  { combo_id: 2, name: 'Coke', unit_price: 20000, quantity: 1, line_total: 20000 },
];

async function paidOrder({ branchId = 1, accountId = null, bookingId = null } = {}) {
  const order = await comboOrderRepository.createOrder({
    branchId,
    accountId,
    bookingId,
    items,
    totalPrice: 120000,
  });
  return comboOrderRepository.markPaid(order.id, 'CASH');
}

describe('kds.service.getBoard', () => {
  it('lists only paid orders of the branch, mapped to KDS statuses, FIFO by payment', async () => {
    const a = await paidOrder();
    const b = await paidOrder();
    await comboOrderRepository.markPreparing(b.id);
    await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 120000 }); // PENDING
    const neverPaid = await comboOrderRepository.createOrder({
      branchId: 1,
      items,
      totalPrice: 120000,
    });
    await comboOrderRepository.cancel(neverPaid.id, 'changed mind'); // cancelled before payment
    await paidOrder({ branchId: 2 }); // another branch
    await ComboOrder.updateOne(
      { id: a.id },
      { $set: { paid_at: new Date(Date.now() - 5 * 60000) } },
    );

    const board = await kdsService.getBoard(1);
    expect(board.branch_id).toBe(1);
    expect(board.orders.map((o) => [o.id, o.status])).toEqual([
      [a.id, 'NEW'],
      [b.id, 'PREPARING'],
    ]);
    expect(board.counts).toEqual({ NEW: 1, PREPARING: 1, READY: 0, COMPLETED: 0, CANCELLED: 0 });
    expect(board.truncated).toBe(false);
  });

  it('shows the order without any price, with items, quantity, created time and per-status timestamps', async () => {
    const order = await paidOrder();
    const [shaped] = (await kdsService.getBoard(1)).orders;

    expect(shaped).toEqual(
      expect.objectContaining({
        id: order.id,
        code: order.code,
        status: 'NEW',
        items: [
          { combo_id: 1, name: 'Popcorn Combo', quantity: 2 },
          { combo_id: 2, name: 'Coke', quantity: 1 },
        ],
        item_count: 3,
        created_at: order.createdAt,
        status_changed_at: order.paid_at,
        next_statuses: ['PREPARING', 'CANCELLED'],
        customer: null,
        booking: null,
      }),
    );
    expect(shaped.timestamps).toEqual({
      NEW: order.paid_at,
      PREPARING: null,
      READY: null,
      COMPLETED: null,
      CANCELLED: null,
    });
    expect(JSON.stringify(shaped)).not.toMatch(/price|line_total|total/);
  });

  it('adds the customer name and the booking seats/room/showtime when the order has them', async () => {
    await Account.create({
      id: 10,
      email: 'buyer@example.com',
      password: 'x',
      name: 'Lan Nguyen',
      phone: '0900',
    });
    await Room.create({ id: 5, cinema_id: 1, name: 'Hall 3' });
    await Schedule.create({
      id: 7,
      movie_id: 1,
      room_id: 5,
      cinema_id: 1,
      movie_date: '2026-10-02',
      time_begin: '19:30',
      time_end: '21:30',
      price: 90000,
    });
    await Ticket.create([
      { id: 1, schedule_id: 7, seat_index: 9, seat_code: 'B10', status: 0 },
      { id: 2, schedule_id: 7, seat_index: 1, seat_code: 'B2', status: 0 },
    ]);
    await Booking.create({
      id: 3,
      code: 'BK-3',
      account_id: 10,
      schedule_id: 7,
      branch_id: 1,
      ticket_ids: [1, 2],
      total_price: 300000,
      status: 'PAID',
    });
    await paidOrder({ accountId: 10, bookingId: 3 });

    const [shaped] = (await kdsService.getBoard(1)).orders;
    expect(shaped.customer).toEqual({ id: 10, name: 'Lan Nguyen' }); // no email / phone on the KDS
    expect(shaped.booking).toEqual({
      id: 3,
      code: 'BK-3',
      seats: ['B2', 'B10'],
      room: 'Hall 3',
      showtime: { date: '2026-10-02', time: '19:30' },
    });
  });

  it('never shows the seats of a booking from another branch', async () => {
    await Booking.create({
      id: 3,
      code: 'BK-3',
      account_id: 10,
      schedule_id: 7,
      branch_id: 2,
      total_price: 1,
    });
    await paidOrder({ bookingId: 3 });
    const [shaped] = (await kdsService.getBoard(1)).orders;
    expect(shaped.booking).toBeNull();
  });

  it('keeps finished orders only within the recent window; active ones whatever their age', async () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const oldNew = await paidOrder();
    const recentDone = await paidOrder();
    const oldDone = await paidOrder();
    const recentCancelled = await paidOrder();
    for (const o of [recentDone, oldDone]) {
      await comboOrderRepository.markPreparing(o.id);
      await comboOrderRepository.markReady(o.id);
      await comboOrderRepository.markDelivered(o.id);
    }
    await comboOrderRepository.cancel(recentCancelled.id, 'burnt');
    await ComboOrder.updateOne(
      { id: oldNew.id },
      { $set: { paid_at: new Date('2026-10-01T08:00:00Z') } },
    );
    await ComboOrder.updateOne(
      { id: recentDone.id },
      { $set: { delivered_at: new Date('2026-10-02T11:30:00Z') } },
    );
    await ComboOrder.updateOne(
      { id: oldDone.id },
      { $set: { delivered_at: new Date('2026-10-02T10:00:00Z') } },
    );
    await ComboOrder.updateOne(
      { id: recentCancelled.id },
      { $set: { cancelled_at: new Date('2026-10-02T11:59:00Z') } },
    );

    const board = await kdsService.getBoard(1, { now, recentMinutes: 60 });
    const statusById = Object.fromEntries(board.orders.map((o) => [o.id, o.status]));
    expect(statusById).toEqual({
      [oldNew.id]: 'NEW',
      [recentDone.id]: 'COMPLETED',
      [recentCancelled.id]: 'CANCELLED',
    });
    expect(board.orders.find((o) => o.id === recentCancelled.id).cancel_reason).toBe('burnt');

    const wider = await kdsService.getBoard(1, { now, recentMinutes: 180 });
    expect(wider.orders.map((o) => o.id)).toContain(oldDone.id);
  });

  it('filters by KDS status', async () => {
    const a = await paidOrder();
    const b = await paidOrder();
    await comboOrderRepository.markPreparing(b.id);
    const board = await kdsService.getBoard(1, { statuses: ['PREPARING'] });
    expect(board.orders.map((o) => o.id)).toEqual([b.id]);
    expect(board.statuses).toEqual(['PREPARING']);
    expect(a.id).not.toBe(b.id);
  });
});

describe('kds.service.clampRecentMinutes', () => {
  it('defaults junk to 60 and caps at 12 hours', () => {
    expect(kdsService.clampRecentMinutes(undefined)).toBe(60);
    expect(kdsService.clampRecentMinutes('abc')).toBe(60);
    expect(kdsService.clampRecentMinutes(-5)).toBe(60);
    expect(kdsService.clampRecentMinutes('30')).toBe(30);
    expect(kdsService.clampRecentMinutes(100000)).toBe(720);
  });
});
