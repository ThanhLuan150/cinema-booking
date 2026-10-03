jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, auth, qrFor, localShowtime, seedInSeatWorld } = require('../../tests/inSeatFixtures');
const { errorHandler } = require('../middleware/errorHandler');
const inSeatOrderRoutes = require('./inSeatOrder.routes');
const kdsRoutes = require('./kds.routes');
const { verifySeatQr } = require('../utils/seatQr');
const Booking = require('../models/Booking');
const ComboOrder = require('../models/ComboOrder');
const Inventory = require('../models/Inventory');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');

const app = express();
app.use(express.json());
app.use('/api/in-seat', inSeatOrderRoutes);
app.use('/api/kds', kdsRoutes);
app.use(errorHandler);

const ORIGINAL_ENV = process.env;
let logSpy;
beforeAll(async () => connect());
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  // Mock-mode MoMo (no merchant credentials): the pay URL is built locally, nothing leaves the test.
  process.env = { ...ORIGINAL_ENV };
  for (const key of ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY', 'MOMO_INSEAT_REDIRECT_URL']) {
    delete process.env[key];
  }
  await seedInSeatWorld();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
  logSpy.mockRestore();
});
afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await closeDatabase();
});

const session = (authHeader, qr = qrFor()) =>
  request(app).post('/api/in-seat/session').set('Authorization', authHeader).send({ qr });
const order = (authHeader, body, headers = {}) =>
  request(app).post('/api/in-seat/orders').set('Authorization', authHeader).set(headers).send(body);
const POPCORN_X2_COKE = [
  { combo_id: ID.POPCORN, quantity: 2 },
  { combo_id: ID.COKE, quantity: 1 },
];
const seatQrSheet = (authHeader, scheduleId = ID.SHOWTIME) =>
  request(app).get(`/api/in-seat/showtimes/${scheduleId}/seat-qr`).set('Authorization', authHeader);

describe('In-seat ordering — authorization', () => {
  it('requires authentication on every route', async () => {
    expect((await request(app).post('/api/in-seat/session').send({ qr: qrFor() })).status).toBe(401);
    expect((await request(app).post('/api/in-seat/orders').send({})).status).toBe(401);
    expect((await request(app).get('/api/in-seat/orders')).status).toBe(401);
    expect((await request(app).get('/api/in-seat/orders/CO-1')).status).toBe(401);
    expect((await request(app).post('/api/in-seat/orders/CO-1/momo-confirm').send({})).status).toBe(401);
    expect((await request(app).get('/api/in-seat/showtimes/7/seat-qr')).status).toBe(401);
  });

  it('is a customer feature: staff and Branch Admins hold no inSeatOrder.create/read', async () => {
    for (const header of [auth.fnb1(), auth.owner1()]) {
      expect((await session(header)).status).toBe(403);
      expect((await order(header, { qr: qrFor(), items: POPCORN_X2_COKE })).status).toBe(403);
      expect((await request(app).get('/api/in-seat/orders').set('Authorization', header)).status).toBe(403);
    }
    expect(await ComboOrder.countDocuments()).toBe(0);
  });

  it('a wider scope never widens WHICH seat: the Super Admin without a ticket is refused too', async () => {
    const res = await session(auth.superAdmin());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IN_SEAT_TICKET_REQUIRED');
  });

  it('lets only staff with inSeatOrder.qr print the seat QR sheet, and only for their own branch', async () => {
    expect((await seatQrSheet(auth.lan())).status).toBe(403); // customer
    expect((await seatQrSheet(auth.fnb1())).status).toBe(403); // no Position holds it by default
    expect((await seatQrSheet(auth.owner2())).status).toBe(403); // Branch Admin of ANOTHER branch
    expect((await seatQrSheet(auth.owner1())).status).toBe(200);
    expect((await seatQrSheet(auth.superAdmin(), ID.BRANCH_2_SHOWTIME)).status).toBe(200);
    expect((await seatQrSheet(auth.owner1(), 999)).status).toBe(404);
    expect((await seatQrSheet(auth.owner1(), 'abc')).status).toBe(404);
  });

  it('the sheet carries one verifiable QR per seat of the showtime, naming branch, room, showtime and seat', async () => {
    const res = await seatQrSheet(auth.owner1());
    expect(res.body).toEqual(
      expect.objectContaining({
        branch: { id: ID.BRANCH_1, name: 'CineNova Central' },
        room: { id: ID.ROOM, name: 'Hall 3' },
        showtime: expect.objectContaining({ id: ID.SHOWTIME, status: 'ACTIVE' }),
      }),
    );
    expect(res.body.seats.map((s) => s.seat_code)).toEqual(['E7', 'E8', 'E9']);
    for (const seat of res.body.seats) {
      expect(verifySeatQr(seat.token).payload).toEqual({
        branchId: ID.BRANCH_1,
        roomId: ID.ROOM,
        scheduleId: ID.SHOWTIME,
        seatCode: seat.seat_code,
      });
    }
  });
});

describe('In-seat ordering — the seat QR must match Branch, Room, Showtime, Seat and a valid ticket', () => {
  it('opens a session for the ticket holder: seat, showtime, booking, ordering window and the branch menu', async () => {
    const res = await session(auth.lan());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        branch: { id: ID.BRANCH_1, name: 'CineNova Central' },
        room: { id: ID.ROOM, name: 'Hall 3' },
        seat: { code: 'E7' },
        ticket: { id: ID.LAN_INVOICE, status: 'ISSUED' },
        booking: { id: ID.LAN_BOOKING, code: 'BK-100' },
        movie: expect.objectContaining({ name: 'Dune: Part Three' }),
        ordering: expect.objectContaining({ open: true, reason: null }),
        orders: [],
      }),
    );
    expect(res.body.showtime.id).toBe(ID.SHOWTIME);
    // Only this branch's ACTIVE combos (not the retired one, not branch 2's).
    expect(res.body.menu.map((m) => m.id).sort()).toEqual([ID.POPCORN, ID.COKE].sort());
    expect(JSON.stringify(res.body)).not.toContain('SQR1.'); // the QR itself is never echoed back
  });

  it('accepts the scanned URL as well as the bare token', async () => {
    const res = await session(auth.lan(), `https://cinema.example.com/InSeat?qr=${encodeURIComponent(qrFor())}`);
    expect(res.status).toBe(200);
  });

  it('refuses an edited QR (another showtime pasted over a genuine signature) — 400 SEAT_QR_INVALID', async () => {
    const [prefix, body, signature] = qrFor().split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const edited = `${prefix}.${Buffer.from(JSON.stringify({ ...payload, s: ID.LATER_SHOWTIME })).toString('base64url')}.${signature}`;
    for (const qr of [edited, 'TCK-not-a-seat', '', null]) {
      const res = await session(auth.lan(), qr);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SEAT_QR_INVALID');
    }
  });

  it("refuses a genuine QR of ANOTHER showtime of the same seat — the customer's ticket is not for it", async () => {
    const res = await session(auth.lan(), qrFor({ scheduleId: ID.LATER_SHOWTIME }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IN_SEAT_TICKET_REQUIRED');
  });

  it('refuses the QR of the right seat when the ticket held is for another showtime', async () => {
    // Lan's booking is moved to the later showtime: her E7 ticket now belongs to showtime 8.
    await Ticket.updateOne({ id: 11 }, { $set: { status: Ticket.STATUS.BOOKED } });
    await Ticket.updateOne({ id: 1 }, { $set: { status: Ticket.STATUS.AVAILABLE } });
    await Invoice.updateOne({ id: ID.LAN_INVOICE }, { $set: { ticket_id: 11 } });
    await Booking.updateOne({ id: ID.LAN_BOOKING }, { $set: { schedule_id: ID.LATER_SHOWTIME, ticket_ids: [11] } });

    const res = await session(auth.lan(), qrFor({ scheduleId: ID.SHOWTIME }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IN_SEAT_TICKET_REQUIRED');
  });

  it("refuses someone else's seat, an unsold seat, and a customer with no ticket at all", async () => {
    for (const [header, seatCode] of [
      [auth.lan(), 'E8'], // Minh's seat
      [auth.lan(), 'E9'], // nobody's
      [auth.noTicket(), 'E7'],
    ]) {
      const res = await session(header, qrFor({ seatCode }));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('IN_SEAT_TICKET_REQUIRED');
    }
  });

  it.each([
    ['CANCELLED', { ticket_status: 'CANCELLED', status: 0 }],
    ['REFUNDED', { ticket_status: 'REFUNDED', status: 2 }],
    ['EXPIRED', { ticket_status: 'EXPIRED' }],
  ])('refuses a %s ticket', async (_label, set) => {
    await Invoice.updateOne({ id: ID.LAN_INVOICE }, { $set: set });
    const res = await session(auth.lan());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IN_SEAT_TICKET_REQUIRED');
  });

  it('accepts a ticket already checked in at the door (USED) — the customer is in their seat', async () => {
    await Invoice.updateOne({ id: ID.LAN_INVOICE }, { $set: { ticket_status: 'USED', checked_in: true } });
    const res = await session(auth.lan());
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('USED');
  });

  it('refuses when the booking behind the ticket is not paid', async () => {
    await Booking.updateOne({ id: ID.LAN_BOOKING }, { $set: { status: 'CANCELLED' } });
    expect((await session(auth.lan())).body.code).toBe('IN_SEAT_TICKET_REQUIRED');
  });

  it('refuses a genuine QR that no longer matches its showtime/room/branch — 409 SEAT_QR_STALE', async () => {
    const cases = [
      qrFor({ roomId: ID.OTHER_ROOM }), // showtime 7 is not in Hall 4
      qrFor({ branchId: ID.BRANCH_2 }), // Hall 3 is not in branch 2
      qrFor({ seatCode: 'Z99' }), // no such seat in this showtime's grid
      qrFor({ scheduleId: 12345 }), // no such showtime
    ];
    for (const qr of cases) {
      const res = await session(auth.lan(), qr);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SEAT_QR_STALE');
    }
    // The showtime is moved to another room after the QR was printed.
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { room_id: ID.OTHER_ROOM } });
    expect((await session(auth.lan())).body.code).toBe('SEAT_QR_STALE');
  });

  it('refuses a cancelled showtime — 409 SHOWTIME_NOT_ACTIVE', async () => {
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { status: 'CANCELLED' } });
    const res = await session(auth.lan());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SHOWTIME_NOT_ACTIVE');
  });
});

describe('In-seat ordering — the ordering window', () => {
  it('shows the seat before ordering opens, but refuses an order — 409 IN_SEAT_ORDERING_NOT_OPEN', async () => {
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: localShowtime(180) });
    const res = await session(auth.lan());
    expect(res.status).toBe(200);
    expect(res.body.ordering).toEqual(
      expect.objectContaining({ open: false, reason: 'IN_SEAT_ORDERING_NOT_OPEN' }),
    );
    const placed = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE });
    expect(placed.status).toBe(409);
    expect(placed.body.code).toBe('IN_SEAT_ORDERING_NOT_OPEN');
    expect(new Date(placed.body.opens_at).getTime()).toBeGreaterThan(Date.now());
    expect(await ComboOrder.countDocuments()).toBe(0);
  });

  it('refuses an order once the film is nearly over — 409 IN_SEAT_ORDERING_CLOSED', async () => {
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: localShowtime(-110) }); // ends in 10 minutes
    const placed = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE });
    expect(placed.status).toBe(409);
    expect(placed.body.code).toBe('IN_SEAT_ORDERING_CLOSED');
  });
});

describe('In-seat ordering — placing an order', () => {
  it('creates a PENDING in-seat order linked to the booking and seat, plus a PENDING MoMo payment', async () => {
    const res = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE });
    expect(res.status).toBe(201);
    expect(res.body.pay_url).toContain(encodeURIComponent(res.body.order.code));
    expect(res.body.pay_url).toContain('/InSeat/PaymentResult');
    expect(res.body.order).toEqual(
      expect.objectContaining({
        status: 'PENDING',
        total_price: 160000,
        booking_id: ID.LAN_BOOKING,
        seat: { code: 'E7', room: 'Hall 3', showtime: expect.objectContaining({ id: ID.SHOWTIME }) },
        payment: { status: 'PENDING', method: 'MOMO', amount: 160000 },
      }),
    );

    const stored = await ComboOrder.findOne({ code: res.body.order.code });
    expect(stored.channel).toBe('IN_SEAT');
    expect(stored.account_id).toBe(ID.LAN);
    expect(stored.booking_id).toBe(ID.LAN_BOOKING);
    expect(stored.branch_id).toBe(ID.BRANCH_1);
    expect(stored.toJSON().seat_delivery).toEqual({
      schedule_id: ID.SHOWTIME,
      room_id: ID.ROOM,
      seat_code: 'E7',
      invoice_id: ID.LAN_INVOICE,
    });
    expect(stored.items.map((i) => [i.combo_id, i.unit_price, i.quantity, i.line_total])).toEqual([
      [ID.POPCORN, 65000, 2, 130000],
      [ID.COKE, 30000, 1, 30000],
    ]);
    // Payment window = BOOKING_HOLD_TIME (default 5 minutes).
    expect(stored.expires_at.getTime() - Date.now()).toBeGreaterThan(4 * 60 * 1000);
    expect(stored.expires_at.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);

    const payment = await Payment.findOne({ code: stored.code });
    expect(payment).toEqual(
      expect.objectContaining({
        type: 'IN_SEAT',
        method: 'MOMO',
        status: 'PENDING',
        amount: 160000,
        booking_id: ID.LAN_BOOKING,
        account_id: ID.LAN,
        branch_id: ID.BRANCH_1,
      }),
    );

    // Unpaid, so it is NOT in the kitchen yet.
    const board = await request(app).get('/api/kds/branches/1/orders').set('Authorization', auth.fnb1());
    expect(board.body.orders).toEqual([]);
  });

  it('merges repeated lines of the same combo', async () => {
    const res = await order(auth.lan(), {
      qr: qrFor(),
      items: [
        { combo_id: ID.COKE, quantity: 1 },
        { combo_id: ID.COKE, quantity: 2 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.order.items).toEqual([
      { combo_id: ID.COKE, name: 'Coke', unit_price: 30000, quantity: 3, line_total: 90000 },
    ]);
  });

  it('never takes a price from the client: price fields are refused, nothing is created', async () => {
    const cases = [
      { qr: qrFor(), items: POPCORN_X2_COKE, total_price: 1000 },
      { qr: qrFor(), items: [{ combo_id: ID.POPCORN, quantity: 1, unit_price: 1 }] },
      { qr: qrFor(), items: [{ combo_id: ID.POPCORN, quantity: 1, discount: 50000 }] },
    ];
    for (const body of cases) {
      const res = await order(auth.lan(), body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('IN_SEAT_PRICE_READONLY');
    }
    expect(await ComboOrder.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('refuses any other unknown field (the seat comes from the QR only)', async () => {
    const res = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE, seat_code: 'A1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IN_SEAT_FIELD_NOT_ALLOWED');
    const line = await order(auth.lan(), { qr: qrFor(), items: [{ combo_id: ID.COKE, quantity: 1, note: 'x' }] });
    expect(line.body.code).toBe('IN_SEAT_FIELD_NOT_ALLOWED');
  });

  it.each([
    ['no items', [], 'IN_SEAT_ITEMS_REQUIRED'],
    ['zero quantity', [{ combo_id: ID.COKE, quantity: 0 }], 'IN_SEAT_INVALID_ITEM'],
    ['fractional quantity', [{ combo_id: ID.COKE, quantity: 1.5 }], 'IN_SEAT_INVALID_ITEM'],
    ['absurd quantity', [{ combo_id: ID.COKE, quantity: 500 }], 'IN_SEAT_INVALID_ITEM'],
    ['unknown combo', [{ combo_id: 999, quantity: 1 }], 'COMBO_NOT_FOUND'],
    ["another branch's combo", [{ combo_id: ID.NACHOS, quantity: 1 }], 'COMBO_BRANCH_MISMATCH'],
    ['an inactive combo', [{ combo_id: ID.RETIRED, quantity: 1 }], 'COMBO_INACTIVE'],
  ])('refuses %s (400)', async (_label, items, code) => {
    const res = await order(auth.lan(), { qr: qrFor(), items });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(await ComboOrder.countDocuments()).toBe(0);
  });

  it('refuses up front when a tracked item is out of stock — 409 INSUFFICIENT_STOCK', async () => {
    await Inventory.create({ id: 1, branch_id: ID.BRANCH_1, combo_id: ID.POPCORN, item: 'Large Popcorn', quantity: 1 });
    const res = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(await ComboOrder.countDocuments()).toBe(0);
  });

  it('enforces the same seat/ticket rules when ordering as when opening the session', async () => {
    const res = await order(auth.lan(), { qr: qrFor({ scheduleId: ID.LATER_SHOWTIME }), items: POPCORN_X2_COKE });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('IN_SEAT_TICKET_REQUIRED');
    expect(await ComboOrder.countDocuments()).toBe(0);
  });

  it('is idempotent per Idempotency-Key, and a key cannot be borrowed by another customer', async () => {
    const headers = { 'Idempotency-Key': 'tap-1' };
    const first = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE }, headers);
    const again = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE }, headers);
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.order.code).toBe(first.body.order.code);
    expect(again.body.pay_url).toBe(first.body.pay_url);
    expect(await ComboOrder.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1);

    const stolen = await order(auth.minh(), { qr: qrFor({ seatCode: 'E8' }), items: POPCORN_X2_COKE }, headers);
    expect(stolen.status).toBe(409);
    expect(stolen.body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });
});

describe('In-seat ordering — reading orders', () => {
  it("returns the caller's own orders and hides everyone else's (404, not 403)", async () => {
    const lan = await order(auth.lan(), { qr: qrFor(), items: POPCORN_X2_COKE });
    const minh = await order(auth.minh(), { qr: qrFor({ seatCode: 'E8' }), items: [{ combo_id: ID.COKE, quantity: 1 }] });

    const own = await request(app).get(`/api/in-seat/orders/${lan.body.order.code}`).set('Authorization', auth.lan());
    expect(own.status).toBe(200);
    expect(own.body.code).toBe(lan.body.order.code);
    expect(own.body.pay_url).toBeTruthy(); // still payable

    const peek = await request(app).get(`/api/in-seat/orders/${minh.body.order.code}`).set('Authorization', auth.lan());
    expect(peek.status).toBe(404);
    expect(peek.body.code).toBe('IN_SEAT_ORDER_NOT_FOUND');

    const list = await request(app).get('/api/in-seat/orders').set('Authorization', auth.lan());
    expect(list.body.map((o) => o.code)).toEqual([lan.body.order.code]);

    const forShowtime = await request(app)
      .get(`/api/in-seat/orders?scheduleId=${ID.LATER_SHOWTIME}`)
      .set('Authorization', auth.lan());
    expect(forShowtime.body).toEqual([]);

    // The session lists what was already ordered to this seat.
    expect((await session(auth.lan())).body.orders.map((o) => o.code)).toEqual([lan.body.order.code]);
  });

  it('does not expose counter/booking combo orders through the in-seat endpoints', async () => {
    await ComboOrder.create({
      id: 77,
      code: 'CO-COUNTER',
      branch_id: ID.BRANCH_1,
      account_id: ID.LAN,
      items: [{ combo_id: ID.COKE, name: 'Coke', unit_price: 30000, quantity: 1, line_total: 30000 }],
      total_price: 30000,
    });
    const res = await request(app).get('/api/in-seat/orders/CO-COUNTER').set('Authorization', auth.lan());
    expect(res.status).toBe(404);
    expect((await request(app).get('/api/in-seat/orders').set('Authorization', auth.lan())).body).toEqual([]);
  });
});
