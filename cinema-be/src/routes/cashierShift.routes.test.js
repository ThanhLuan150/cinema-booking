const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const cashierShiftRoutes = require('./cashierShift.routes');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const CashierShift = require('../models/CashierShift');
const Payment = require('../models/Payment');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');
const AuditLog = require('../models/AuditLog');

const app = buildTestApp('/api/cashier-shifts', cashierShiftRoutes);

beforeAll(async () => {
  await connect();
  await CashierShift.init();
});
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
  await seedBranchesAndStaff();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42; // Branch Admin of branch 1
const OWNER_B = 99; // Branch Admin of branch 2
const CASHIER_A = 7; // account id — CASHIER at branch 1
const CASHIER_A2 = 12; // account id — a second CASHIER at branch 1
const CASHIER_B = 8; // account id — CASHIER at branch 2
const COMBO_STAFF_A = 9; // account id — COMBO_STAFF at branch 1 (no cashierShift.* grants)
const TICKET_STAFF_A = 11; // account id — TICKET_STAFF at branch 1

async function positionId(code) {
  return (await Position.findOne({ code })).id;
}

async function seedBranchesAndStaff() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
  await Employee.create([
    { id: 1, user_id: CASHIER_A, branch_id: 1, employee_code: 'EMP-1', position_id: await positionId('CASHIER'), status: 1 },
    { id: 2, user_id: CASHIER_B, branch_id: 2, employee_code: 'EMP-2', position_id: await positionId('CASHIER'), status: 1 },
    {
      id: 3,
      user_id: COMBO_STAFF_A,
      branch_id: 1,
      employee_code: 'EMP-3',
      position_id: await positionId('COMBO_STAFF'),
      status: 1,
    },
    {
      id: 4,
      user_id: TICKET_STAFF_A,
      branch_id: 1,
      employee_code: 'EMP-4',
      position_id: await positionId('TICKET_STAFF'),
      status: 1,
    },
    { id: 5, user_id: CASHIER_A2, branch_id: 1, employee_code: 'EMP-5', position_id: await positionId('CASHIER'), status: 1 },
  ]);
}

function openShift(accountId, body = {}) {
  return request(app)
    .post('/api/cashier-shifts/open')
    .set('Authorization', authHeader({ role: 3, accountId }))
    .send({ branch_id: 1, opening_cash: 500000, ...body });
}

async function seedCashSale(shiftId, amount, overrides = {}) {
  const id = (await Payment.countDocuments()) + 1;
  return Payment.create({
    id,
    code: `POS-${id}`,
    booking_id: id,
    account_id: 500,
    branch_id: 1,
    type: 'COUNTER',
    method: 'CASH',
    amount,
    status: 'PAID',
    paid_at: new Date(),
    shift_id: shiftId,
    ...overrides,
  });
}

// --- Open ------------------------------------------------------------------

describe('POST /api/cashier-shifts/open', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/cashier-shifts/open').send({ branch_id: 1, opening_cash: 1 });
    expect(res.status).toBe(401);
  });

  it('is forbidden for a customer', async () => {
    const res = await request(app)
      .post('/api/cashier-shifts/open')
      .set('Authorization', authHeader({ role: 1, accountId: 500 }))
      .send({ branch_id: 1, opening_cash: 500000 });
    expect(res.status).toBe(403);
  });

  it('is forbidden for an employee whose position does not work a drawer', async () => {
    const res = await openShift(COMBO_STAFF_A);
    expect(res.status).toBe(403);
  });

  it('is forbidden for a Branch Admin — overseeing drawers is not working one', async () => {
    const res = await request(app)
      .post('/api/cashier-shifts/open')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ branch_id: 1, opening_cash: 500000 });
    expect(res.status).toBe(403);
  });

  it('forbids a cashier opening a shift at a branch they are not staffed at', async () => {
    const res = await openShift(CASHIER_B, { branch_id: 1 });
    expect(res.status).toBe(403);
  });

  it('opens a shift for a CASHIER at their own branch', async () => {
    const res = await openShift(CASHIER_A);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      employee_id: 1,
      account_id: CASHIER_A,
      branch_id: 1,
      opening_cash: 500000,
      status: 'OPEN',
    });
    expect(res.body.expected_cash).toBeNull();
    expect(res.body.actual_cash).toBeNull();
    expect(res.body.difference).toBeNull();
  });

  it('opens a shift for a TICKET_STAFF too', async () => {
    const res = await openShift(TICKET_STAFF_A);
    expect(res.status).toBe(201);
    expect(res.body.employee_id).toBe(4);
  });

  it('rejects a missing or negative opening float', async () => {
    expect((await openShift(CASHIER_A, { opening_cash: undefined })).status).toBe(400);
    expect((await openShift(CASHIER_A, { opening_cash: -1 })).status).toBe(400);
    expect((await openShift(CASHIER_A, { opening_cash: 'lots' })).status).toBe(400);
    expect(await CashierShift.countDocuments()).toBe(0);
  });

  // "Không cho Frontend tự quyết định expected_cash"
  it('ignores expected_cash / actual_cash / difference sent by the client', async () => {
    const res = await openShift(CASHIER_A, { expected_cash: 99999999, actual_cash: 88888888, difference: 7777 });
    expect(res.status).toBe(201);
    const stored = await CashierShift.findOne({ id: res.body.id });
    expect(stored.expected_cash).toBeNull();
    expect(stored.actual_cash).toBeNull();
    expect(stored.difference).toBeNull();
  });

  it('refuses a second open shift for the same cashier', async () => {
    expect((await openShift(CASHIER_A)).status).toBe(201);
    const res = await openShift(CASHIER_A);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SHIFT_ALREADY_OPEN');
    expect(await CashierShift.countDocuments()).toBe(1);
  });

  it('lets only one of several concurrent opens through', async () => {
    const responses = await Promise.all([openShift(CASHIER_A), openShift(CASHIER_A), openShift(CASHIER_A)]);
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    for (const res of responses.filter((r) => r.status !== 201)) {
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SHIFT_ALREADY_OPEN');
    }
    expect(await CashierShift.countDocuments({ employee_id: 1, status: 'OPEN' })).toBe(1);
  });

  it('does not block a different cashier at the same branch', async () => {
    expect((await openShift(CASHIER_A)).status).toBe(201);
    expect((await openShift(CASHIER_A2)).status).toBe(201);
  });

  it('writes a SHIFT_OPENED audit row', async () => {
    const res = await openShift(CASHIER_A);
    const log = await AuditLog.findOne({ entity_type: 'CASHIER_SHIFT', action: 'SHIFT_OPENED' });
    expect(log).toMatchObject({ entity_id: res.body.id, performed_by: CASHIER_A, branch_id: 1 });
    expect(log.metadata).toMatchObject({ employeeId: 1, openingCash: 500000 });
  });
});

// --- Close -----------------------------------------------------------------

describe('POST /api/cashier-shifts/:id/close', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/cashier-shifts/1/close').send({ actual_cash: 1 });
    expect(res.status).toBe(401);
  });

  it('404s for a shift that does not exist', async () => {
    const res = await request(app)
      .post('/api/cashier-shifts/999/close')
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
      .send({ actual_cash: 500000 });
    expect(res.status).toBe(404);
  });

  it('rejects a missing or negative cash count', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    for (const actual_cash of [undefined, -5, 'none']) {
      const res = await request(app)
        .post(`/api/cashier-shifts/${shift.id}/close`)
        .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
        .send({ actual_cash });
      expect(res.status).toBe(400);
    }
    expect((await CashierShift.findOne({ id: shift.id })).status).toBe('OPEN');
  });

  // cashierShift.close is OWN-scoped for a cashier.
  it('forbids a cashier closing a colleague’s drawer', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    const res = await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A2 }))
      .send({ actual_cash: 500000 });
    expect(res.status).toBe(403);
    expect((await CashierShift.findOne({ id: shift.id })).status).toBe('OPEN');
  });

  it('computes expected_cash and difference from the shift’s own transactions', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    await seedCashSale(shift.id, 300000);
    await seedCashSale(shift.id, 200000);
    await seedCashSale(shift.id, 900000, { method: 'CARD' }); // card takings never hit the drawer
    await ComboOrder.create({
      id: 1,
      code: 'CO-1',
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Combo', unit_price: 90000, quantity: 1, line_total: 90000 }],
      total_price: 90000,
      status: 'PAID',
      payment_method: 'CASH',
      paid_at: new Date(),
      shift_id: shift.id,
    });
    await Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: 500,
      branch_id: 1,
      amount: 40000,
      policy_percent: 100,
      status: 'COMPLETED',
      shift_id: shift.id,
    });

    const res = await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
      .send({ actual_cash: 1040000, note: 'short' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'CLOSED',
      cash_sales: 590000, // 300000 + 200000 tickets + 90000 combo
      cash_refunds: 40000,
      expected_cash: 1050000, // 500000 float + 590000 - 40000
      actual_cash: 1040000,
      difference: -10000,
      closed_by: CASHIER_A,
      close_note: 'short',
    });
    expect(res.body.closed_at).toBeTruthy();
  });

  it('reports a zero difference when the count matches, and a positive one when the drawer is over', async () => {
    const { body: first } = await openShift(CASHIER_A);
    await seedCashSale(first.id, 100000);
    const exact = await request(app)
      .post(`/api/cashier-shifts/${first.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
      .send({ actual_cash: 600000 });
    expect(exact.body.difference).toBe(0);

    const { body: second } = await openShift(CASHIER_A2);
    const over = await request(app)
      .post(`/api/cashier-shifts/${second.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A2 }))
      .send({ actual_cash: 525000 });
    expect(over.body.expected_cash).toBe(500000);
    expect(over.body.difference).toBe(25000);
  });

  it('ignores an expected_cash the client tries to dictate', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    await seedCashSale(shift.id, 100000);

    const res = await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
      .send({ actual_cash: 600000, expected_cash: 1, cash_sales: 1, cash_refunds: 1, difference: 0 });

    expect(res.body.expected_cash).toBe(600000);
    expect(res.body.cash_sales).toBe(100000);
    expect(res.body.cash_refunds).toBe(0);
    expect(res.body.difference).toBe(0);
  });

  it('refuses to close a shift twice and keeps the first settlement', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    const auth = authHeader({ role: 3, accountId: CASHIER_A });
    expect((await request(app).post(`/api/cashier-shifts/${shift.id}/close`).set('Authorization', auth).send({ actual_cash: 500000 })).status).toBe(200);

    const res = await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', auth)
      .send({ actual_cash: 12345678 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SHIFT_ALREADY_CLOSED');
    expect((await CashierShift.findOne({ id: shift.id })).actual_cash).toBe(500000);
  });

  it('settles the drawer once when two closes race', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    const auth = authHeader({ role: 3, accountId: CASHIER_A });
    const responses = await Promise.all([
      request(app).post(`/api/cashier-shifts/${shift.id}/close`).set('Authorization', auth).send({ actual_cash: 500000 }),
      request(app).post(`/api/cashier-shifts/${shift.id}/close`).set('Authorization', auth).send({ actual_cash: 500000 }),
    ]);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(1);
  });

  it('lets a Branch Admin settle a drawer at their own branch', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    const res = await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ actual_cash: 500000 });
    expect(res.status).toBe(200);
    expect(res.body.closed_by).toBe(OWNER_A);
  });

  it('forbids a Branch Admin from another branch', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    const res = await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
      .send({ actual_cash: 500000 });
    expect(res.status).toBe(403);
  });

  it('lets SUPER_ADMIN settle any drawer', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    const res = await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ actual_cash: 500000 });
    expect(res.status).toBe(200);
  });

  it('writes a SHIFT_CLOSED audit row carrying the settlement', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    await seedCashSale(shift.id, 100000);
    await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
      .send({ actual_cash: 590000 });

    const log = await AuditLog.findOne({ entity_type: 'CASHIER_SHIFT', action: 'SHIFT_CLOSED' });
    expect(log).toMatchObject({ entity_id: shift.id, performed_by: CASHIER_A, branch_id: 1 });
    expect(log.metadata).toMatchObject({
      openingCash: 500000,
      cashSales: 100000,
      cashRefunds: 0,
      expectedCash: 600000,
      actualCash: 590000,
      difference: -10000,
    });
  });
});

// --- Read scopes -----------------------------------------------------------

describe('GET /api/cashier-shifts', () => {
  async function seedThreeShifts() {
    const a = (await openShift(CASHIER_A)).body;
    const b = (await openShift(CASHIER_A2)).body;
    const c = (
      await request(app)
        .post('/api/cashier-shifts/open')
        .set('Authorization', authHeader({ role: 3, accountId: CASHIER_B }))
        .send({ branch_id: 2, opening_cash: 300000 })
    ).body;
    return { a, b, c };
  }

  it('requires auth', async () => {
    expect((await request(app).get('/api/cashier-shifts')).status).toBe(401);
  });

  it('is forbidden for a customer', async () => {
    const res = await request(app).get('/api/cashier-shifts').set('Authorization', authHeader({ role: 1, accountId: 500 }));
    expect(res.status).toBe(403);
  });

  it('shows a cashier only their own shifts', async () => {
    const { a } = await seedThreeShifts();
    const res = await request(app)
      .get('/api/cashier-shifts')
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }));
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.id)).toEqual([a.id]);
  });

  it('does not let a cashier widen the list by asking for someone else', async () => {
    const { a } = await seedThreeShifts();
    const res = await request(app)
      .get('/api/cashier-shifts?employeeId=5&branchId=2')
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }));
    expect(res.body.data.map((s) => s.id)).toEqual([a.id]);
  });

  it('shows a Branch Admin every drawer at their branch and none from elsewhere', async () => {
    const { a, b } = await seedThreeShifts();
    const res = await request(app)
      .get('/api/cashier-shifts')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
    expect(res.body.data.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('refuses to widen a Branch Admin’s view to another branch', async () => {
    const { a, b } = await seedThreeShifts();
    const res = await request(app)
      .get('/api/cashier-shifts?branchId=2')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
    expect(res.body.data.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });


  it('shows SUPER_ADMIN every shift, and filters by branch on request', async () => {
    const { a, b, c } = await seedThreeShifts();
    const auth = authHeader({ role: 0, accountId: 1 });

    const all = await request(app).get('/api/cashier-shifts').set('Authorization', auth);
    expect(all.body.total).toBe(3);
    expect(all.body.data.map((s) => s.id).sort()).toEqual([a.id, b.id, c.id].sort());

    const branch2 = await request(app).get('/api/cashier-shifts?branchId=2').set('Authorization', auth);
    expect(branch2.body.data.map((s) => s.id)).toEqual([c.id]);
  });

  it('filters by status', async () => {
    const { a } = await seedThreeShifts();
    await request(app)
      .post(`/api/cashier-shifts/${a.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
      .send({ actual_cash: 500000 });

    const auth = authHeader({ role: 0, accountId: 1 });
    expect((await request(app).get('/api/cashier-shifts?status=CLOSED').set('Authorization', auth)).body.total).toBe(1);
    expect((await request(app).get('/api/cashier-shifts?status=OPEN').set('Authorization', auth)).body.total).toBe(2);
  });
});

describe('GET /api/cashier-shifts/current', () => {
  it('returns nulls when the cashier has no drawer open', async () => {
    const res = await request(app)
      .get('/api/cashier-shifts/current')
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ shift: null, reconciliation: null });
  });

  it('returns the open drawer with running totals but no count yet', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    await seedCashSale(shift.id, 250000);

    const res = await request(app)
      .get('/api/cashier-shifts/current')
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }));
    expect(res.body.shift.id).toBe(shift.id);
    expect(res.body.reconciliation).toMatchObject({
      openingCash: 500000,
      cashSales: 250000,
      cashRefunds: 0,
      expectedCash: 750000,
      actualCash: null,
      difference: null,
      live: true,
    });
  });

  it('stops reporting a drawer once it is closed', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    await request(app)
      .post(`/api/cashier-shifts/${shift.id}/close`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }))
      .send({ actual_cash: 500000 });

    const res = await request(app)
      .get('/api/cashier-shifts/current')
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }));
    expect(res.body.shift).toBeNull();
  });
});

describe('GET /api/cashier-shifts/:id', () => {
  it('404s for an unknown shift', async () => {
    const res = await request(app)
      .get('/api/cashier-shifts/999')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(404);
  });

  it('lets the owning cashier read their own shift', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    const res = await request(app)
      .get(`/api/cashier-shifts/${shift.id}`)
      .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A }));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(shift.id);
  });

  it('forbids another cashier and a Branch Admin from another branch', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    expect(
      (
        await request(app)
          .get(`/api/cashier-shifts/${shift.id}`)
          .set('Authorization', authHeader({ role: 3, accountId: CASHIER_A2 }))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(`/api/cashier-shifts/${shift.id}`)
          .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
      ).status,
    ).toBe(403);
  });
});

describe('GET /api/cashier-shifts/:id/reconciliation', () => {
  it('shows live totals while open and the frozen settlement once closed', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    await seedCashSale(shift.id, 100000);
    const auth = authHeader({ role: 3, accountId: CASHIER_A });

    const live = await request(app).get(`/api/cashier-shifts/${shift.id}/reconciliation`).set('Authorization', auth);
    expect(live.status).toBe(200);
    expect(live.body.reconciliation).toMatchObject({ expectedCash: 600000, live: true });

    await request(app).post(`/api/cashier-shifts/${shift.id}/close`).set('Authorization', auth).send({ actual_cash: 595000 });

    const settled = await request(app).get(`/api/cashier-shifts/${shift.id}/reconciliation`).set('Authorization', auth);
    expect(settled.body.reconciliation).toMatchObject({
      openingCash: 500000,
      cashSales: 100000,
      cashRefunds: 0,
      expectedCash: 600000,
      actualCash: 595000,
      difference: -5000,
      live: false,
    });
  });

  it('is branch-scoped for a Branch Admin', async () => {
    const { body: shift } = await openShift(CASHIER_A);
    expect(
      (
        await request(app)
          .get(`/api/cashier-shifts/${shift.id}/reconciliation`)
          .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/cashier-shifts/${shift.id}/reconciliation`)
          .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
      ).status,
    ).toBe(403);
  });
});
