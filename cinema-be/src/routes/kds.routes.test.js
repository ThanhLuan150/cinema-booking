jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const kdsRoutes = require('./kds.routes');
const comboOrderRoutes = require('./comboOrder.routes');
const socket = require('../utils/socket');
const Branch = require('../models/Branch');
const Combo = require('../models/Combo');
const ComboOrder = require('../models/ComboOrder');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Inventory = require('../models/Inventory');

const app = express();
app.use(express.json());
app.use('/api/kds', kdsRoutes);
app.use('/api/combo-orders', comboOrderRoutes);
app.use(errorHandler);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

const OWNER_1 = 42;
const OWNER_2 = 43;
const FNB_1 = 7; // F&B Staff at branch 1
const FNB_2 = 8; // F&B Staff at branch 2
const CONCESSION_1 = 9; // Concession Staff at branch 1 (sells AND works the queue)
const CASHIER_1 = 11; // Cashier at branch 1 (sells, takes payment, no kitchen queue)
const SUPER_ADMIN = 1;

const as = (role, accountId) => authHeader({ role, accountId });
const fnb1 = () => as(3, FNB_1);
const fnb2 = () => as(3, FNB_2);
const concession1 = () => as(3, CONCESSION_1);
const cashier1 = () => as(3, CASHIER_1);
const superAdmin = () => as(0, SUPER_ADMIN);

async function staff(accountId, branchId, positionCode, id) {
  const position = await Position.findOne({ code: positionCode });
  await Employee.create({
    id,
    user_id: accountId,
    branch_id: branchId,
    employee_code: `E${id}`,
    position_id: position.id,
    status: 1,
  });
}

async function seedBranches() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_1, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_2, name: 'Branch B', code: 'B' },
  ]);
  await Combo.create([
    { id: 1, cinema_id: 1, name: 'Popcorn Combo', price: 50000, active: true, type: 'FOOD' },
    { id: 2, cinema_id: 2, name: 'Nachos', price: 60000, active: true },
  ]);
  await staff(FNB_1, 1, 'FNB_STAFF', 1);
  await staff(FNB_2, 2, 'FNB_STAFF', 2);
  await staff(CONCESSION_1, 1, 'CONCESSION_STAFF', 3);
  await staff(CASHIER_1, 1, 'CASHIER', 4);
}

// A sale the normal way: the counter creates the order, then payment clears it into the kitchen.
async function sellAndPay(branchId = 1, { pay = true } = {}) {
  const comboId = branchId === 1 ? 1 : 2;
  const created = await request(app)
    .post('/api/combo-orders')
    .set('Authorization', superAdmin())
    .send({ branch_id: branchId, items: [{ combo_id: comboId, quantity: 2 }] });
  expect(created.status).toBe(201);
  if (!pay) return created.body;
  const paid = await request(app)
    .post(`/api/combo-orders/${created.body.id}/pay`)
    .set('Authorization', superAdmin())
    .send({ method: 'CASH' });
  expect(paid.status).toBe(200);
  return paid.body;
}

const board = (branchId, auth, query = '') =>
  request(app).get(`/api/kds/branches/${branchId}/orders${query}`).set('Authorization', auth);
const move = (branchId, orderId, auth, body) =>
  request(app)
    .patch(`/api/kds/branches/${branchId}/orders/${orderId}/status`)
    .set('Authorization', auth)
    .send(body);

beforeEach(seedBranches);

describe('KDS access control', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/kds/branches/1/orders')).status).toBe(401);
    expect(
      (await request(app).patch('/api/kds/branches/1/orders/1/status').send({ status: 'READY' }))
        .status,
    ).toBe(401);
  });

  it('is closed to customers, Branch Admins and a Cashier (no combo.order.* permission)', async () => {
    const order = await sellAndPay();
    for (const auth of [as(1, 500), as(2, OWNER_1), cashier1()]) {
      expect((await board(1, auth)).status).toBe(403);
      expect((await move(1, order.id, auth, { status: 'PREPARING' })).status).toBe(403);
    }
    expect((await ComboOrder.findOne({ id: order.id })).status).toBe('PAID');
  });

  it('lets F&B Staff and Concession Staff of the branch read the board and update status', async () => {
    const order = await sellAndPay();
    expect((await board(1, fnb1())).status).toBe(200);
    expect((await board(1, concession1())).status).toBe(200);
    expect((await move(1, order.id, fnb1(), { status: 'PREPARING' })).status).toBe(200);
    expect((await move(1, order.id, concession1(), { status: 'READY' })).status).toBe(200);
  });

  it('returns 404 for a non-numeric branch', async () => {
    expect((await board('abc', fnb1())).status).toBe(404);
  });
});

describe('KDS branch isolation', () => {
  it('refuses another branch board to a staff member (403)', async () => {
    await sellAndPay(2);
    const res = await board(2, fnb1());
    expect(res.status).toBe(403);
  });

  it('shows a branch only its own orders', async () => {
    const mine = await sellAndPay(1);
    await sellAndPay(2);
    const res = await board(1, fnb1());
    expect(res.body.orders.map((o) => o.id)).toEqual([mine.id]);
    expect(res.body.orders.every((o) => o.branch_id === 1)).toBe(true);
  });

  it('refuses to process another branch order through this branch KDS, even for staff of that other branch', async () => {
    const theirs = await sellAndPay(2);
    // FNB_1 on their own KDS, aiming at branch 2's order.
    const viaOwnKds = await move(1, theirs.id, fnb1(), { status: 'PREPARING' });
    expect(viaOwnKds.status).toBe(403);
    expect(viaOwnKds.body.code).toBe('KDS_BRANCH_MISMATCH');
    // FNB_1 through branch 2's KDS URL: not staffed there.
    expect((await move(2, theirs.id, fnb1(), { status: 'PREPARING' })).status).toBe(403);
    // FNB_2 (staffed at branch 2) through branch 1's KDS URL: not staffed there.
    expect((await move(1, theirs.id, fnb2(), { status: 'PREPARING' })).status).toBe(403);
    expect((await ComboOrder.findOne({ id: theirs.id })).status).toBe('PAID');
  });

  it('pins even the Super Admin to the KDS branch in the URL', async () => {
    const theirs = await sellAndPay(2);
    const res = await move(1, theirs.id, superAdmin(), { status: 'PREPARING' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KDS_BRANCH_MISMATCH');
    expect((await move(2, theirs.id, superAdmin(), { status: 'PREPARING' })).status).toBe(200);
  });
});

describe('KDS shows paid orders only', () => {
  it('keeps an unpaid order off the board and refuses to process it', async () => {
    const unpaid = await sellAndPay(1, { pay: false });
    const res = await board(1, fnb1());
    expect(res.body.orders).toEqual([]);

    const moved = await move(1, unpaid.id, fnb1(), { status: 'PREPARING' });
    expect(moved.status).toBe(409);
    expect(moved.body.code).toBe('KDS_ORDER_NOT_PAID');
    expect((await ComboOrder.findOne({ id: unpaid.id })).status).toBe('PENDING');
  });

  it('a KDS cancel cannot touch an unpaid order either', async () => {
    const unpaid = await sellAndPay(1, { pay: false });
    const res = await move(1, unpaid.id, fnb1(), { status: 'CANCELLED', reason: 'nope' });
    expect(res.status).toBe(409);
    expect((await ComboOrder.findOne({ id: unpaid.id })).status).toBe('PENDING');
  });

  it('the order appears the moment it is paid', async () => {
    const order = await sellAndPay(1);
    const res = await board(1, fnb1());
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([
      expect.objectContaining({
        id: order.id,
        code: order.code,
        status: 'NEW',
        items: [{ combo_id: 1, name: 'Popcorn Combo', quantity: 2 }],
        item_count: 2,
        next_statuses: ['PREPARING', 'CANCELLED'],
      }),
    ]);
    expect(res.body.orders[0].created_at).toBeTruthy();
    expect(res.body.orders[0].timestamps.NEW).toBeTruthy();
  });

  it('returns 404 for an unknown order', async () => {
    const res = await move(1, 9999, fnb1(), { status: 'PREPARING' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('KDS_ORDER_NOT_FOUND');
  });

  it('400s an unknown status filter', async () => {
    const res = await board(1, fnb1(), '?status=NEW,PAID');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_KDS_STATUS');
  });
});

describe('KDS workflow', () => {
  it('drives NEW -> PREPARING -> READY -> COMPLETED, stamping a timestamp for each status', async () => {
    const order = await sellAndPay();

    const preparing = await move(1, order.id, fnb1(), { status: 'PREPARING' });
    expect(preparing.status).toBe(200);
    expect(preparing.body.status).toBe('PREPARING');
    expect(preparing.body.next_statuses).toEqual(['READY', 'CANCELLED']);

    const ready = await move(1, order.id, fnb1(), { status: 'READY' });
    expect(ready.body.status).toBe('READY');
    expect(ready.body.next_statuses).toEqual(['COMPLETED']);

    const completed = await move(1, order.id, fnb1(), { status: 'COMPLETED' });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.next_statuses).toEqual([]);

    const { timestamps } = completed.body;
    for (const status of ['NEW', 'PREPARING', 'READY', 'COMPLETED'])
      expect(timestamps[status]).toBeTruthy();
    expect(timestamps.CANCELLED).toBeNull();
    const times = ['NEW', 'PREPARING', 'READY', 'COMPLETED'].map((s) =>
      new Date(timestamps[s]).getTime(),
    );
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(completed.body.status_changed_at).toBe(timestamps.COMPLETED);

    // Same record the counter sees.
    const stored = await ComboOrder.findOne({ id: order.id });
    expect(stored.status).toBe('DELIVERED');
    expect(stored.delivered_at.toISOString()).toBe(timestamps.COMPLETED);
  });

  it('refuses skipping and going backwards with 409 INVALID_KDS_TRANSITION', async () => {
    const order = await sellAndPay();
    const skip = await move(1, order.id, fnb1(), { status: 'COMPLETED' });
    expect(skip.status).toBe(409);
    expect(skip.body).toEqual(
      expect.objectContaining({ code: 'INVALID_KDS_TRANSITION', from: 'NEW', to: 'COMPLETED' }),
    );

    await move(1, order.id, fnb1(), { status: 'PREPARING' });
    await move(1, order.id, fnb1(), { status: 'READY' });
    const cancelReady = await move(1, order.id, fnb1(), {
      status: 'CANCELLED',
      reason: 'too late',
    });
    expect(cancelReady.status).toBe(409);
    expect(cancelReady.body.code).toBe('INVALID_KDS_TRANSITION');

    const backToNew = await move(1, order.id, fnb1(), { status: 'NEW' });
    expect(backToNew.status).toBe(400);
    expect(backToNew.body.code).toBe('INVALID_KDS_STATUS');
  });

  it('cancels with a mandatory reason, stamps cancelled_at and returns the stock taken', async () => {
    await Inventory.create({
      id: 1,
      branch_id: 1,
      combo_id: 1,
      item: 'Popcorn Combo',
      quantity: 10,
      minimum_quantity: 0,
      unit: 'pcs',
    });
    const order = await sellAndPay();
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(8);

    const noReason = await move(1, order.id, fnb1(), { status: 'CANCELLED' });
    expect(noReason.status).toBe(400);
    expect(noReason.body.code).toBe('KDS_CANCEL_REASON_REQUIRED');

    const cancelled = await move(1, order.id, fnb1(), {
      status: 'CANCELLED',
      reason: 'Machine broken',
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.cancel_reason).toBe('Machine broken');
    expect(cancelled.body.timestamps.CANCELLED).toBeTruthy();
    expect((await Inventory.findOne({ id: 1 })).quantity).toBe(10);

    // Still on the board (recent lane) so the kitchen sees it was stopped.
    const res = await board(1, fnb1());
    expect(res.body.orders.map((o) => [o.id, o.status])).toEqual([[order.id, 'CANCELLED']]);
  });

  it('broadcasts every KDS status change to the branch and the customer', async () => {
    const order = await sellAndPay();
    jest.clearAllMocks();
    await move(1, order.id, fnb1(), { status: 'PREPARING' });
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(1, 'comboOrder:updated', {
      action: 'STATUS_CHANGED',
      id: order.id,
      code: order.code,
      status: 'PREPARING',
    });
    expect(socket.emitToAccount).toHaveBeenCalledTimes(1);
  });

  it('lets exactly one of two simultaneous taps win; the other gets 409 KDS_STATUS_CONFLICT', async () => {
    const order = await sellAndPay();
    const results = await Promise.all([
      move(1, order.id, fnb1(), { status: 'PREPARING' }),
      move(1, order.id, concession1(), { status: 'PREPARING' }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(['KDS_STATUS_CONFLICT', 'INVALID_KDS_TRANSITION']).toContain(loser.body.code);
    expect((await ComboOrder.findOne({ id: order.id })).status).toBe('PREPARING');
  });

  it('ready-vs-cancel race on a PREPARING order: exactly one wins and the other leaves no trace', async () => {
    const order = await sellAndPay();
    await move(1, order.id, fnb1(), { status: 'PREPARING' });
    const [ready, cancel] = await Promise.all([
      move(1, order.id, fnb1(), { status: 'READY' }),
      move(1, order.id, concession1(), { status: 'CANCELLED', reason: 'customer left' }),
    ]);
    expect([ready.status, cancel.status].sort()).toEqual([200, 409]);

    const stored = await ComboOrder.findOne({ id: order.id });
    if (ready.status === 200) {
      expect(stored.status).toBe('READY');
      expect(stored.cancelled_at).toBeNull();
    } else {
      expect(stored.status).toBe('CANCELLED');
      expect(stored.ready_at).toBeNull();
    }
  });
});

describe('KDS cannot change prices', () => {
  it('refuses any price field with 400 KDS_PRICE_READONLY and changes nothing', async () => {
    const order = await sellAndPay();
    for (const body of [
      { status: 'PREPARING', total_price: 1 },
      {
        status: 'PREPARING',
        items: [{ combo_id: 1, name: 'Popcorn Combo', unit_price: 0, quantity: 2 }],
      },
      { status: 'PREPARING', unit_price: 0 },
    ]) {
      const res = await move(1, order.id, fnb1(), body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('KDS_PRICE_READONLY');
    }
    const stored = await ComboOrder.findOne({ id: order.id });
    expect(stored.status).toBe('PAID');
    expect(stored.total_price).toBe(100000);
    expect(stored.items[0].unit_price).toBe(50000);
    expect(stored.items[0].line_total).toBe(100000);
  });

  it('refuses any other field too (only status/reason travel)', async () => {
    const order = await sellAndPay();
    const res = await move(1, order.id, fnb1(), { status: 'PREPARING', branch_id: 2 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('KDS_FIELD_NOT_ALLOWED');
  });

  it('a full KDS run leaves the prices exactly as sold, and the board never exposes them', async () => {
    const order = await sellAndPay();
    for (const status of ['PREPARING', 'READY', 'COMPLETED'])
      await move(1, order.id, fnb1(), { status });
    const stored = await ComboOrder.findOne({ id: order.id });
    expect(stored.total_price).toBe(order.total_price);
    expect(stored.items.map((i) => [i.unit_price, i.line_total])).toEqual([[50000, 100000]]);

    const res = await board(1, fnb1());
    expect(JSON.stringify(res.body.orders)).not.toMatch(/price|line_total/);
  });
});

describe('KDS branch list (GET /api/kds/branches)', () => {
  const branches = (auth) => request(app).get('/api/kds/branches').set('Authorization', auth);

  it('gives the Super Admin every branch with the orders waiting in its kitchen', async () => {
    await sellAndPay(1);
    const preparing = await sellAndPay(1);
    await move(1, preparing.id, superAdmin(), { status: 'PREPARING' });
    await sellAndPay(1, { pay: false }); // unpaid: not on the KDS, not counted
    const done = await sellAndPay(2);
    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      await move(2, done.id, superAdmin(), { status }); // finished: nothing left to make
    }

    const res = await branches(superAdmin());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        name: 'Branch A',
        status: 'ACTIVE',
        counts: { NEW: 1, PREPARING: 1, READY: 0 },
        active: 2,
      },
      {
        id: 2,
        name: 'Branch B',
        status: 'ACTIVE',
        counts: { NEW: 0, PREPARING: 0, READY: 0 },
        active: 0,
      },
    ]);
  });

  it('gives staff only the branch they work at', async () => {
    await sellAndPay(2);
    expect((await branches(fnb1())).body.map((b) => b.id)).toEqual([1]);
    expect((await branches(fnb2())).body).toEqual([
      expect.objectContaining({ id: 2, active: 1, counts: { NEW: 1, PREPARING: 0, READY: 0 } }),
    ]);
  });

  it('is closed to a Cashier, a Branch Admin and a customer', async () => {
    for (const auth of [cashier1(), as(2, OWNER_1), as(1, 500)]) {
      expect((await branches(auth)).status).toBe(403);
    }
  });
});
