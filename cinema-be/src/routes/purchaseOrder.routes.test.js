const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const purchaseOrderRoutes = require('./purchaseOrder.routes');
const inventoryRoutes = require('./inventory.routes');
const inventoryRepository = require('../repositories/inventory.repository');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Permission = require('../models/Permission');
const PositionPermission = require('../models/PositionPermission');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const PurchaseOrder = require('../models/PurchaseOrder');
const AuditLog = require('../models/AuditLog');
const socket = require('../utils/socket');

jest.mock('../utils/socket', () => ({
  emitBranchEvent: jest.fn(),
  emitToAccount: jest.fn(),
  emitToAdmin: jest.fn(),
  emitToBranch: jest.fn(),
  emitToStaff: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await connect();
  await Inventory.init();
  await InventoryTransaction.init();
  await PurchaseOrder.init();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => {
  jest.clearAllMocks();
  await clearDatabase();
});
afterAll(async () => closeDatabase());

const ADMIN_A = authHeader({ role: 2, accountId: 42 }); // Branch Admin of Branch 1
const ADMIN_B = authHeader({ role: 2, accountId: 43 }); // Branch Admin of Branch 2
const SUPER = authHeader({ role: 0, accountId: 1 });
const CUSTOMER = authHeader({ role: 1, accountId: 900 });
const STAFF_ID = 7;
const STAFF = authHeader({ role: 3, accountId: STAFF_ID }); // CONCESSION_STAFF at Branch 1

async function seedWorld() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 43, name: 'Branch B', code: 'B' },
  ]);
  await Supplier.create([
    { id: 1, name: 'Acme Foods', code: 'ACME', status: 'ACTIVE' },
    { id: 2, name: 'Dormant Co', code: 'DORM', status: 'INACTIVE' },
  ]);
  const position = await Position.findOne({ code: 'CONCESSION_STAFF' });
  await Employee.create({ id: 1, user_id: STAFF_ID, branch_id: 1, employee_code: 'E1', position_id: position.id, status: 1 });

  const popcorn = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', sku: 'POP', quantity: 10, minimumQuantity: 5, unit: 'kg', costPrice: 100 });
  const cola = await inventoryRepository.create({ branchId: 1, item: 'Cola', quantity: 0, minimumQuantity: 5, unit: 'can', costPrice: 20 });
  const otherBranchItem = await inventoryRepository.create({ branchId: 2, item: 'Nachos', quantity: 4, minimumQuantity: 2, unit: 'box' });
  return { popcorn, cola, otherBranchItem, position };
}

const stockOf = async (id) => (await Inventory.findOne({ id })).quantity;
const post = (path, auth, body) => request(app).post(`/api/purchase-orders${path}`).set('Authorization', auth).send(body);

async function createDraft(world, overrides = {}, auth = ADMIN_A) {
  const res = await post('', auth, {
    branch_id: 1,
    supplier_id: 1,
    items: [
      { inventory_id: world.popcorn.id, quantity: 20, unit_cost: 90 },
      { inventory_id: world.cola.id, quantity: 100 },
    ],
    ...overrides,
  });
  return res;
}

async function orderedPo(world) {
  const draft = await createDraft(world);
  const confirmed = await post(`/${draft.body.id}/confirm`, ADMIN_A);
  expect(confirmed.status).toBe(200);
  return confirmed.body;
}

// Grants a Position the two stock-in permissions, the way seedPositions would.
async function grantReceive(position) {
  for (const code of ['purchaseOrder.read', 'purchaseOrder.receive']) {
    const permission = await Permission.findOne({ code });
    await PositionPermission.create({ id: 9000 + permission.id, position_id: position.id, permission_id: permission.id, scope: 'BRANCH' });
  }
}

describe('creating a purchase order', () => {
  it('creates a DRAFT with a server-computed total and snapshots each line, without touching stock', async () => {
    const world = await seedWorld();
    const res = await createDraft(world, { total_amount: 1 }); // a client-sent total must be ignored

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'DRAFT',
      branch_id: 1,
      supplier_id: 1,
      supplier: { id: 1, name: 'Acme Foods', code: 'ACME' },
      // 20 * 90 (explicit cost) + 100 * 20 (defaults to the product's cost_price)
      total_amount: 3800,
    });
    expect(res.body.code).toMatch(/^PO-\d{6}$/);
    expect(res.body.items[0]).toMatchObject({ item: 'Popcorn', sku: 'POP', unit: 'kg', quantity: 20, unit_cost: 90, line_total: 1800 });
    expect(res.body.items[1]).toMatchObject({ item: 'Cola', unit_cost: 20, line_total: 2000 });
    expect(await stockOf(world.popcorn.id)).toBe(10);
    expect(await stockOf(world.cola.id)).toBe(0);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });

  it('can be saved as an empty draft', async () => {
    await seedWorld();
    const res = await post('', ADMIN_A, { branch_id: 1, supplier_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ items: [], total_amount: 0 });
  });

  it('rejects an unknown or inactive supplier', async () => {
    const world = await seedWorld();
    const missing = await createDraft(world, { supplier_id: 99 });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('SUPPLIER_NOT_FOUND');
    const inactive = await createDraft(world, { supplier_id: 2 });
    expect(inactive.status).toBe(400);
    expect(inactive.body.code).toBe('SUPPLIER_INACTIVE');
  });

  it.each([
    ['a zero quantity', { inventory_id: 1, quantity: 0 }],
    ['a negative quantity (a receipt must never remove stock)', { inventory_id: 1, quantity: -5 }],
    ['a non-numeric quantity', { inventory_id: 1, quantity: 'lots' }],
    ['an infinite quantity', { inventory_id: 1, quantity: 'Infinity' }],
    ['a negative unit cost', { inventory_id: 1, quantity: 1, unit_cost: -1 }],
    ['a line without inventory_id', { quantity: 1 }],
  ])('rejects %s', async (_label, line) => {
    await seedWorld();
    const res = await post('', ADMIN_A, { branch_id: 1, supplier_id: 1, items: [line] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects the same product twice on one order', async () => {
    const world = await seedWorld();
    const res = await createDraft(world, {
      items: [
        { inventory_id: world.popcorn.id, quantity: 1 },
        { inventory_id: world.popcorn.id, quantity: 2 },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DUPLICATE_LINE');
  });

  it("rejects a product from another branch (stock is per branch) and a product that does not exist", async () => {
    const world = await seedWorld();
    const foreign = await createDraft(world, { items: [{ inventory_id: world.otherBranchItem.id, quantity: 1 }] });
    expect(foreign.status).toBe(400);
    expect(foreign.body.code).toBe('INVENTORY_BRANCH_MISMATCH');
    const ghost = await createDraft(world, { items: [{ inventory_id: 9999, quantity: 1 }] });
    expect(ghost.status).toBe(400);
    expect(ghost.body.code).toBe('INVENTORY_NOT_FOUND');
  });

  it('rejects an expected date earlier than the order date, accepts the same day', async () => {
    const world = await seedWorld();
    const early = await createDraft(world, { order_date: '2026-10-10', expected_date: '2026-10-09' });
    expect(early.status).toBe(400);
    expect(early.body.code).toBe('EXPECTED_BEFORE_ORDER');
    const sameDay = await createDraft(world, { order_date: '2026-10-10', expected_date: '2026-10-10' });
    expect(sameDay.status).toBe(201);
    const junk = await createDraft(world, { expected_date: 'not-a-date' });
    expect(junk.status).toBe(400);
  });

  it('records an audit entry', async () => {
    const world = await seedWorld();
    const res = await createDraft(world);
    const entry = await AuditLog.findOne({ action: 'PURCHASE_ORDER_CREATED', entity_id: res.body.id });
    expect(entry).toMatchObject({ entity_type: 'PURCHASE_ORDER', branch_id: 1, performed_by: 42 });
  });
});

describe('the lifecycle: DRAFT -> ORDERED -> RECEIVED', () => {
  it('only RECEIVED raises stock; DRAFT and ORDERED leave Inventory untouched', async () => {
    const world = await seedWorld();
    const draft = await createDraft(world);
    expect(await stockOf(world.popcorn.id)).toBe(10);

    const ordered = await post(`/${draft.body.id}/confirm`, ADMIN_A);
    expect(ordered.status).toBe(200);
    expect(ordered.body).toMatchObject({ status: 'ORDERED', ordered_by: 42 });
    expect(await stockOf(world.popcorn.id)).toBe(10);
    expect(await stockOf(world.cola.id)).toBe(0);

    const received = await post(`/${draft.body.id}/receive`, ADMIN_A);
    expect(received.status).toBe(200);
    expect(received.body).toMatchObject({ status: 'RECEIVED', received_by: 42 });
    expect(received.body.movements).toHaveLength(2);
    expect(await stockOf(world.popcorn.id)).toBe(30);
    expect(await stockOf(world.cola.id)).toBe(100);
    // Cola climbed out of OUT_OF_STOCK: status is recomputed with the quantity.
    expect((await Inventory.findOne({ id: world.cola.id })).status).toBe('IN_STOCK');
  });

  it('writes one IMPORT history row per line, tied to the order', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    await post(`/${po.id}/receive`, ADMIN_A);

    const rows = await InventoryTransaction.find({ ref_type: 'PURCHASE_ORDER' }).sort({ inventory_id: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: 'IMPORT',
      inventory_id: world.popcorn.id,
      quantity_change: 20,
      quantity_before: 10,
      quantity_after: 30,
      ref_code: `${po.code}:${world.popcorn.id}`,
      performed_by: 42,
    });
    const history = await request(app).get(`/api/inventory/${world.popcorn.id}/history`).set('Authorization', ADMIN_A);
    expect(history.body.data[0]).toMatchObject({ type: 'IMPORT', quantity_change: 20 });
  });

  it('receiving twice adds stock once', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    expect((await post(`/${po.id}/receive`, ADMIN_A)).status).toBe(200);
    const again = await post(`/${po.id}/receive`, ADMIN_A);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('PURCHASE_ORDER_ALREADY_RECEIVED');
    expect(await stockOf(world.popcorn.id)).toBe(30);
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(2);
  });

  it('two simultaneous receives add stock exactly once', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    const results = await Promise.all([post(`/${po.id}/receive`, ADMIN_A), post(`/${po.id}/receive`, ADMIN_A), post(`/${po.id}/receive`, SUPER)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(await stockOf(world.popcorn.id)).toBe(30);
    expect(await stockOf(world.cola.id)).toBe(100);
  });

  it('a DRAFT cannot be received; a CANCELLED order cannot be received', async () => {
    const world = await seedWorld();
    const draft = await createDraft(world);
    const early = await post(`/${draft.body.id}/receive`, ADMIN_A);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('PURCHASE_ORDER_NOT_ORDERED');

    await post(`/${draft.body.id}/cancel`, ADMIN_A, { reason: 'changed mind' });
    const late = await post(`/${draft.body.id}/receive`, ADMIN_A);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('PURCHASE_ORDER_CANCELLED');
    expect(await stockOf(world.popcorn.id)).toBe(10);
  });

  it('cancelling an ORDERED order keeps stock unchanged, and a RECEIVED order cannot be cancelled', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    const cancelled = await post(`/${po.id}/cancel`, ADMIN_A, { reason: 'supplier out of stock' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancel_reason: 'supplier out of stock', cancelled_by: 42 });
    expect(await stockOf(world.popcorn.id)).toBe(10);
    expect((await post(`/${po.id}/cancel`, ADMIN_A)).body.code).toBe('PURCHASE_ORDER_ALREADY_CANCELLED');

    const second = await orderedPo(world);
    await post(`/${second.id}/receive`, ADMIN_A);
    const tooLate = await post(`/${second.id}/cancel`, ADMIN_A);
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.code).toBe('PURCHASE_ORDER_ALREADY_RECEIVED');
    expect(await stockOf(world.popcorn.id)).toBe(30);
  });

  it('confirming needs at least one line and an active supplier, and works only once', async () => {
    const world = await seedWorld();
    const empty = await post('', ADMIN_A, { branch_id: 1, supplier_id: 1 });
    const noLines = await post(`/${empty.body.id}/confirm`, ADMIN_A);
    expect(noLines.status).toBe(400);
    expect(noLines.body.code).toBe('EMPTY_ORDER');

    const draft = await createDraft(world);
    await Supplier.updateOne({ id: 1 }, { $set: { status: 'INACTIVE' } });
    const inactive = await post(`/${draft.body.id}/confirm`, ADMIN_A);
    expect(inactive.status).toBe(400);
    expect(inactive.body.code).toBe('SUPPLIER_INACTIVE');
    await Supplier.updateOne({ id: 1 }, { $set: { status: 'ACTIVE' } });

    expect((await post(`/${draft.body.id}/confirm`, ADMIN_A)).status).toBe(200);
    const twice = await post(`/${draft.body.id}/confirm`, ADMIN_A);
    expect(twice.status).toBe(409);
    expect(twice.body.code).toBe('INVALID_STATUS');
  });

  it('refuses to receive (and changes nothing) when a product disappeared from the branch', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    await Inventory.deleteOne({ id: world.cola.id }); // bypasses the API guard on purpose
    const res = await post(`/${po.id}/receive`, ADMIN_A);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'INVENTORY_MISSING', inventory_id: world.cola.id });
    // All-or-nothing: the popcorn line that precedes the missing one was NOT applied, and the order
    // is still ORDERED so it can be fixed and retried.
    expect(await stockOf(world.popcorn.id)).toBe(10);
    expect((await PurchaseOrder.findOne({ id: po.id })).status).toBe('ORDERED');
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(0);
  });

  it('audits the lifecycle and broadcasts to the branch', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    await post(`/${po.id}/receive`, ADMIN_A);
    const actions = (await AuditLog.find({ entity_id: po.id, entity_type: 'PURCHASE_ORDER' })).map((e) => e.action).sort();
    expect(actions).toEqual(['PURCHASE_ORDER_CONFIRMED', 'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_RECEIVED']);
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(
      1,
      'purchaseOrder:updated',
      expect.objectContaining({ id: po.id, status: 'RECEIVED' }),
    );
    // Stock changes are announced per product on the existing inventory channel.
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(1, 'inventory:updated', expect.objectContaining({ id: world.popcorn.id, quantity: 30 }));
  });
});

describe('editing and deleting', () => {
  it('a draft can be edited: lines are replaced and the total recomputed', async () => {
    const world = await seedWorld();
    const draft = await createDraft(world);
    const res = await request(app)
      .put(`/api/purchase-orders/${draft.body.id}`)
      .set('Authorization', ADMIN_A)
      .send({ items: [{ inventory_id: world.popcorn.id, quantity: 5, unit_cost: 10 }], note: 'urgent' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total_amount: 50, note: 'urgent' });
    expect(res.body.items).toHaveLength(1);
  });

  it('an ORDERED order is frozen', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    const res = await request(app).put(`/api/purchase-orders/${po.id}`).set('Authorization', ADMIN_A).send({ note: 'sneaky' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PURCHASE_ORDER_NOT_EDITABLE');
  });

  it('only a draft can be deleted', async () => {
    const world = await seedWorld();
    const draft = await createDraft(world);
    const ordered = await orderedPo(world);
    const refused = await request(app).delete(`/api/purchase-orders/${ordered.id}`).set('Authorization', ADMIN_A);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('PURCHASE_ORDER_NOT_DELETABLE');
    const ok = await request(app).delete(`/api/purchase-orders/${draft.body.id}`).set('Authorization', ADMIN_A);
    expect(ok.status).toBe(200);
    expect(await PurchaseOrder.countDocuments({ id: draft.body.id })).toBe(0);
  });

  it('a product on an open order cannot be deleted from Inventory; once received it can', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    const blocked = await request(app).delete(`/api/inventory/${world.popcorn.id}`).set('Authorization', ADMIN_A);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('INVENTORY_IN_OPEN_PURCHASE_ORDER');
    await post(`/${po.id}/receive`, ADMIN_A);
    const allowed = await request(app).delete(`/api/inventory/${world.popcorn.id}`).set('Authorization', ADMIN_A);
    expect(allowed.status).toBe(200);
  });
});

describe('authorization', () => {
  it('requires authentication', async () => {
    await seedWorld();
    expect((await request(app).get('/api/purchase-orders')).status).toBe(401);
  });

  it('a customer can do nothing', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    expect((await request(app).get('/api/purchase-orders').set('Authorization', CUSTOMER)).status).toBe(403);
    expect((await post(`/${po.id}/receive`, CUSTOMER)).status).toBe(403);
    expect((await createDraft(world, {}, CUSTOMER)).status).toBe(403);
  });

  it('an ordinary Employee cannot receive stock, create, confirm or even read orders', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);

    expect((await post(`/${po.id}/receive`, STAFF)).status).toBe(403);
    expect((await createDraft(world, {}, STAFF)).status).toBe(403);
    expect((await post(`/${po.id}/confirm`, STAFF)).status).toBe(403);
    expect((await post(`/${po.id}/cancel`, STAFF)).status).toBe(403);
    expect((await request(app).get('/api/purchase-orders').set('Authorization', STAFF)).status).toBe(403);
    expect((await request(app).get(`/api/purchase-orders/${po.id}`).set('Authorization', STAFF)).status).toBe(403);
    // ...and the direct inventory import route stays closed to them too.
    expect(
      (await request(app).post(`/api/inventory/${world.popcorn.id}/import`).set('Authorization', STAFF).send({ quantity: 5 })).status,
    ).toBe(403);
    expect(await stockOf(world.popcorn.id)).toBe(10);
    expect((await PurchaseOrder.findOne({ id: po.id })).status).toBe('ORDERED');
  });

  it('an Employee whose Position was granted purchaseOrder.receive can receive at their own branch — and nothing more', async () => {
    const world = await seedWorld();
    await grantReceive(world.position);
    const po = await orderedPo(world);

    const list = await request(app).get('/api/purchase-orders').set('Authorization', STAFF);
    expect(list.status).toBe(200);
    expect(list.body.data.map((o) => o.id)).toEqual([po.id]);

    // Managing the order is still not theirs.
    expect((await post(`/${po.id}/cancel`, STAFF)).status).toBe(403);
    expect((await createDraft(world, {}, STAFF)).status).toBe(403);

    const received = await post(`/${po.id}/receive`, STAFF);
    expect(received.status).toBe(200);
    expect(received.body.received_by).toBe(STAFF_ID);
    expect(await stockOf(world.popcorn.id)).toBe(30);
  });

  it("a granted Employee cannot receive another branch's order", async () => {
    const world = await seedWorld();
    await grantReceive(world.position);
    const supplier = await post('', ADMIN_B, { branch_id: 2, supplier_id: 1, items: [{ inventory_id: world.otherBranchItem.id, quantity: 3 }] });
    await post(`/${supplier.body.id}/confirm`, ADMIN_B);

    const res = await post(`/${supplier.body.id}/receive`, STAFF);
    expect(res.status).toBe(403);
    expect(await stockOf(world.otherBranchItem.id)).toBe(4);
  });

  it("a Branch Admin cannot see, edit, confirm, cancel or receive another branch's orders", async () => {
    const world = await seedWorld();
    const po = await orderedPo(world); // Branch 1's order

    expect((await request(app).get(`/api/purchase-orders/${po.id}`).set('Authorization', ADMIN_B)).status).toBe(403);
    expect((await request(app).get('/api/purchase-orders?branchId=1').set('Authorization', ADMIN_B)).status).toBe(403);
    expect((await request(app).put(`/api/purchase-orders/${po.id}`).set('Authorization', ADMIN_B).send({ note: 'x' })).status).toBe(403);
    expect((await post(`/${po.id}/cancel`, ADMIN_B)).status).toBe(403);
    expect((await post(`/${po.id}/receive`, ADMIN_B)).status).toBe(403);
    expect((await request(app).delete(`/api/purchase-orders/${po.id}`).set('Authorization', ADMIN_B)).status).toBe(403);
    // Cannot create an order INTO another branch either.
    expect((await createDraft(world, { branch_id: 1 }, ADMIN_B)).status).toBe(403);
    expect(await stockOf(world.popcorn.id)).toBe(10);

    // The list is scoped to their own branches.
    const own = await request(app).get('/api/purchase-orders').set('Authorization', ADMIN_B);
    expect(own.body.data).toEqual([]);
  });

  it('a Super Admin sees every branch and can act anywhere', async () => {
    const world = await seedWorld();
    const po = await orderedPo(world);
    const list = await request(app).get('/api/purchase-orders').set('Authorization', SUPER);
    expect(list.body.total).toBe(1);
    expect((await post(`/${po.id}/receive`, SUPER)).status).toBe(200);
  });

  it('answers 404 for an unknown order', async () => {
    await seedWorld();
    expect((await request(app).get('/api/purchase-orders/999').set('Authorization', ADMIN_A)).status).toBe(404);
    expect((await post('/999/confirm', ADMIN_A)).status).toBe(404);
    expect((await post('/999/receive', ADMIN_A)).status).toBe(404);
  });
});

describe('listing', () => {
  it('filters by status, supplier and code, and paginates', async () => {
    const world = await seedWorld();
    const a = await createDraft(world);
    const b = await orderedPo(world);
    await Supplier.create({ id: 3, name: 'Other', code: 'OTHER', status: 'ACTIVE' });
    const c = await createDraft(world, { supplier_id: 3 });

    const byStatus = await request(app).get('/api/purchase-orders?status=ORDERED').set('Authorization', ADMIN_A);
    expect(byStatus.body.data.map((o) => o.id)).toEqual([b.id]);
    const bySupplier = await request(app).get('/api/purchase-orders?supplierId=3').set('Authorization', ADMIN_A);
    expect(bySupplier.body.data.map((o) => o.id)).toEqual([c.body.id]);
    const byCode = await request(app).get(`/api/purchase-orders?q=${a.body.code}`).set('Authorization', ADMIN_A);
    expect(byCode.body.data.map((o) => o.id)).toEqual([a.body.id]);
    const paged = await request(app).get('/api/purchase-orders?limit=2&page=2').set('Authorization', ADMIN_A);
    expect(paged.body).toMatchObject({ total: 3, page: 2, limit: 2, totalPages: 2 });
    expect(paged.body.data).toHaveLength(1);
  });
});
