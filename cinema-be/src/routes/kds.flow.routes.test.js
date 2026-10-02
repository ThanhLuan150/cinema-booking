// Ticket 48 end to end, over HTTP, through the real sale endpoints rather than fixtures:
//   Cashier sells ticket + combo at the Box Office (payment included)  -> KDS NEW with the seat
//   Concession Staff sells a combo at the counter -> invisible on the KDS until paid -> NEW
//   F&B Staff: NEW -> PREPARING -> READY -> COMPLETED, every step timestamped, prices untouched.
jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed
// Every mailer export resolves without sending anything.
jest.mock('../utils/mailer', () =>
  Object.fromEntries(
    Object.keys(jest.requireActual('../utils/mailer')).map((name) => [
      name,
      jest.fn().mockResolvedValue({}),
    ]),
  ),
);

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const kdsRoutes = require('./kds.routes');
const comboOrderRoutes = require('./comboOrder.routes');
const boxOfficeRoutes = require('./boxOffice.routes');
const socket = require('../utils/socket');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Combo = require('../models/Combo');
const ComboOrder = require('../models/ComboOrder');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');

const app = express();
app.use(express.json());
app.use('/api/kds', kdsRoutes);
app.use('/api/combo-orders', comboOrderRoutes);
app.use('/api/box-office', boxOfficeRoutes);
app.use(errorHandler);

const CASHIER = 7;
const FNB = 8;
const CONCESSION = 9;
const CUSTOMER = 10;
const auth = (accountId) => authHeader({ role: 3, accountId });

let logSpy;
beforeAll(async () => connect());
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  await seedRbac();
  await seedPositions();

  await Branch.create({
    id: 1,
    company_id: 1,
    owner_id: 42,
    name: 'CineNova Central',
    code: 'CEN',
  });
  await Account.create({
    id: CUSTOMER,
    email: 'lan@example.com',
    password: 'x',
    name: 'Lan Nguyen',
    role: 1,
  });
  for (const [id, accountId, code] of [
    [1, CASHIER, 'CASHIER'],
    [2, FNB, 'FNB_STAFF'],
    [3, CONCESSION, 'CONCESSION_STAFF'],
  ]) {
    const position = await Position.findOne({ code });
    await Employee.create({
      id,
      user_id: accountId,
      branch_id: 1,
      employee_code: `E${id}`,
      position_id: position.id,
      status: 1,
    });
  }
  await Combo.create({
    id: 1,
    cinema_id: 1,
    name: 'Large Popcorn',
    price: 65000,
    type: 'FOOD',
    active: true,
  });
  await Room.create({ id: 5, cinema_id: 1, name: 'Hall 3' });
  await Schedule.create({
    id: 7,
    movie_id: 1,
    room_id: 5,
    cinema_id: 1,
    movie_date: '2099-01-01',
    time_begin: '19:30',
    time_end: '21:30',
    price: 90000,
  });
  // The cashier has already locked seat E7 (bookseat/:id/hold), as the Box Office requires.
  await Ticket.create({
    id: 1,
    schedule_id: 7,
    seat_index: 38,
    seat_code: 'E7',
    status: Ticket.STATUS.HELD,
    held_by: CASHIER,
    held_until: new Date(Date.now() + 10 * 60000),
  });
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
  logSpy.mockRestore();
});
afterAll(async () => closeDatabase());

const board = (accountId) =>
  request(app).get('/api/kds/branches/1/orders').set('Authorization', auth(accountId));
const move = (orderId, status, extra = {}) =>
  request(app)
    .patch(`/api/kds/branches/1/orders/${orderId}/status`)
    .set('Authorization', auth(FNB))
    .send({ status, ...extra });

describe('Ticket 48 flow — Cashier -> payment -> KDS -> PREPARING -> READY -> COMPLETED', () => {
  it('a Box Office sale with a combo lands on the KDS as NEW, with customer and seat, and F&B Staff completes it', async () => {
    const sale = await request(app)
      .post('/api/box-office/sell')
      .set('Authorization', auth(CASHIER))
      .send({
        cinema_id: 1,
        scheduleId: 7,
        ticketIds: [1],
        comboIds: [1, 1],
        accountId: CUSTOMER,
        method: 'CASH',
      });
    expect(sale.status).toBe(201);

    // Paid at the counter, so it is announced to the branch straight away (live KDS refresh).
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(
      1,
      'comboOrder:updated',
      expect.objectContaining({ action: 'CREATED', status: 'PAID' }),
    );

    const res = await board(FNB);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    const [order] = res.body.orders;
    expect(order).toEqual(
      expect.objectContaining({
        status: 'NEW',
        items: [{ combo_id: 1, name: 'Large Popcorn', quantity: 2 }],
        item_count: 2,
        customer: { id: CUSTOMER, name: 'Lan Nguyen' },
        booking: expect.objectContaining({
          seats: ['E7'],
          room: 'Hall 3',
          showtime: { date: '2099-01-01', time: '19:30' },
        }),
      }),
    );
    expect(order.code).toMatch(/^CO-/);
    expect(order.created_at).toBeTruthy();
    expect(order.timestamps.NEW).toBeTruthy();

    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      const step = await move(order.id, status);
      expect(step.status).toBe(200);
      expect(step.body.status).toBe(status);
      expect(step.body.timestamps[status]).toBeTruthy();
    }

    const stored = await ComboOrder.findOne({ id: order.id });
    expect(stored.status).toBe('DELIVERED');
    expect(stored.total_price).toBe(130000); // as sold — the KDS never touched it
    expect(stored.items[0].unit_price).toBe(65000);
    for (const field of ['paid_at', 'prepared_at', 'ready_at', 'delivered_at']) {
      expect(stored[field]).toBeInstanceOf(Date);
    }
  });

  it('the Cashier cannot work the KDS (no combo.order.* permission)', async () => {
    expect((await board(CASHIER)).status).toBe(403);
  });

  it('a counter combo sale stays off the KDS until it is paid, then appears as NEW', async () => {
    const created = await request(app)
      .post('/api/combo-orders')
      .set('Authorization', auth(CONCESSION))
      .send({ branch_id: 1, items: [{ combo_id: 1, quantity: 1 }] });
    expect(created.status).toBe(201);
    expect((await board(FNB)).body.orders).toEqual([]);

    const paid = await request(app)
      .post(`/api/combo-orders/${created.body.id}/pay`)
      .set('Authorization', auth(CONCESSION))
      .send({ method: 'CASH' });
    expect(paid.status).toBe(200);

    const after = await board(FNB);
    expect(after.body.orders.map((o) => [o.code, o.status])).toEqual([[created.body.code, 'NEW']]);
    expect(after.body.orders[0].customer).toBeNull(); // walk-up sale: no customer/seat to show
    expect(after.body.orders[0].booking).toBeNull();
  });
});
