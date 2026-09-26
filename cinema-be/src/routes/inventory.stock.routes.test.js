const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const inventoryRoutes = require('./inventory.routes');
const comboOrderRoutes = require('./comboOrder.routes');
const inventoryRepository = require('../repositories/inventory.repository');
const Branch = require('../models/Branch');
const Combo = require('../models/Combo');
const ComboOrder = require('../models/ComboOrder');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');

jest.mock('../utils/socket', () => ({
  emitBranchEvent: jest.fn(),
  emitToAccount: jest.fn(),
}));

// The real error handler (not the test helper's stripped-down one): the FE keys off `code`.
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/inventory', inventoryRoutes);
app.use('/api/combo-orders', comboOrderRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await connect();
  await Inventory.init();
  await InventoryTransaction.init();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const ADMIN_A = authHeader({ role: 2, accountId: 42 }); // Branch Admin of Branch 1
const ADMIN_B = authHeader({ role: 2, accountId: 43 }); // Branch Admin of Branch 2
const SUPER = authHeader({ role: 0, accountId: 1 });
const STAFF_ID = 7;
const STAFF = authHeader({ role: 3, accountId: STAFF_ID }); // CONCESSION_STAFF at Branch 1

// Branch 1 (owner 42) and Branch 2 (owner 43), each with its own Popcorn, plus a bundle at Branch 1.
async function seedWorld({ stockA = 50, stockB = 50, minimum = 10 } = {}) {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 43, name: 'Branch B', code: 'B' },
  ]);
  await Combo.create([
    { id: 1, cinema_id: 1, name: 'Popcorn', price: 50000, type: 'FOOD', active: true },
    { id: 2, cinema_id: 1, name: 'Coke', price: 20000, type: 'BEVERAGE', active: true },
    {
      id: 3,
      cinema_id: 1,
      name: 'Combo',
      price: 60000,
      type: 'COMBO',
      active: true,
      items: [
        { item_id: 1, quantity: 1 },
        { item_id: 2, quantity: 1 },
      ],
    },
    { id: 11, cinema_id: 2, name: 'Popcorn', price: 50000, type: 'FOOD', active: true },
  ]);
  const position = await Position.findOne({ code: 'CONCESSION_STAFF' });
  await Employee.create({ id: 1, user_id: STAFF_ID, branch_id: 1, employee_code: 'E1', position_id: position.id, status: 1 });

  const popcornA = await inventoryRepository.create({ branchId: 1, comboId: 1, item: 'Popcorn', quantity: stockA, minimumQuantity: minimum, unit: 'pcs' });
  const popcornB = await inventoryRepository.create({ branchId: 2, comboId: 11, item: 'Popcorn', quantity: stockB, minimumQuantity: minimum, unit: 'pcs' });
  return { popcornA, popcornB };
}

const placeOrder = (items, auth = STAFF, branchId = 1) =>
  request(app).post('/api/combo-orders').set('Authorization', auth).send({ branch_id: branchId, items });
const pay = (id, auth = STAFF) =>
  request(app).post(`/api/combo-orders/${id}/pay`).set('Authorization', auth).send({ method: 'CASH' });
const stockOf = async (id) => (await Inventory.findOne({ id })).quantity;

describe('Combo sale decreases inventory', () => {
  it('paying an order deducts the sold quantity and writes a SALE history row', async () => {
    const { popcornA } = await seedWorld();
    const created = await placeOrder([{ combo_id: 1, quantity: 2 }]);
    expect(created.status).toBe(201);
    expect(await stockOf(popcornA.id)).toBe(50); // creating an order alone does not move stock

    const paid = await pay(created.body.id);
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('PAID');
    expect(await stockOf(popcornA.id)).toBe(48);

    const history = await request(app).get(`/api/inventory/${popcornA.id}/history`).set('Authorization', ADMIN_A);
    expect(history.body.data[0]).toMatchObject({ type: 'SALE', quantity_change: -2, quantity_after: 48 });
  });

  it('a bundle deducts each component it contains', async () => {
    const { popcornA } = await seedWorld();
    const coke = await inventoryRepository.create({ branchId: 1, comboId: 2, item: 'Coke', quantity: 30, minimumQuantity: 5, unit: 'pcs' });
    const created = await placeOrder([{ combo_id: 3, quantity: 4 }]);
    await pay(created.body.id);
    expect(await stockOf(popcornA.id)).toBe(46);
    expect(await stockOf(coke.id)).toBe(26);
  });

  it('paying the same order twice deducts once', async () => {
    const { popcornA } = await seedWorld();
    const created = await placeOrder([{ combo_id: 1, quantity: 2 }]);
    await pay(created.body.id);
    const again = await pay(created.body.id);
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('ORDER_NOT_PENDING');
    expect(await stockOf(popcornA.id)).toBe(48);
  });
});

describe('Cannot sell beyond stock', () => {
  it('refuses to create an order that exceeds current stock (409 INSUFFICIENT_STOCK)', async () => {
    const { popcornA } = await seedWorld({ stockA: 3 });
    const res = await placeOrder([{ combo_id: 1, quantity: 4 }]);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', item: 'Popcorn', requested: 4, available: 3 });
    expect(res.body.shortages).toHaveLength(1);
    expect(await ComboOrder.countDocuments()).toBe(0);
    expect(await stockOf(popcornA.id)).toBe(3);
  });

  it('allows selling exactly the remaining stock, then refuses the next unit', async () => {
    const { popcornA } = await seedWorld({ stockA: 3 });
    const all = await placeOrder([{ combo_id: 1, quantity: 3 }]);
    expect((await pay(all.body.id)).status).toBe(200);
    expect(await stockOf(popcornA.id)).toBe(0);
    expect((await Inventory.findOne({ id: popcornA.id })).status).toBe('OUT_OF_STOCK');
    expect((await placeOrder([{ combo_id: 1, quantity: 1 }])).status).toBe(409);
  });

  it('a bundle order is refused when any one component is short', async () => {
    await seedWorld();
    await inventoryRepository.create({ branchId: 1, comboId: 2, item: 'Coke', quantity: 1, minimumQuantity: 0, unit: 'pcs' });
    const res = await placeOrder([{ combo_id: 3, quantity: 2 }]);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ item: 'Coke', requested: 2, available: 1 });
  });

  it('items that are not stock-tracked stay sellable', async () => {
    await seedWorld();
    await Combo.create({ id: 5, cinema_id: 1, name: 'Water', price: 10000, type: 'BEVERAGE', active: true });
    expect((await placeOrder([{ combo_id: 5, quantity: 999 }])).status).toBe(201);
  });

  it('two orders each passing the create-time check cannot both be paid when stock only covers one', async () => {
    const { popcornA } = await seedWorld({ stockA: 3 });
    const first = await placeOrder([{ combo_id: 1, quantity: 2 }]);
    const second = await placeOrder([{ combo_id: 1, quantity: 2 }]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    expect((await pay(first.body.id)).status).toBe(200);
    const refused = await pay(second.body.id);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('INSUFFICIENT_STOCK');

    // The refused sale left nothing half-done: still PENDING, unpaid, and stock is only the first sale's.
    const order = await ComboOrder.findOne({ id: second.body.id });
    expect(order).toMatchObject({ status: 'PENDING', paid_at: null, payment_method: null });
    expect(await stockOf(popcornA.id)).toBe(1);

    // After a restock the same order can be paid.
    await request(app).post(`/api/inventory/${popcornA.id}/import`).set('Authorization', ADMIN_A).send({ quantity: 5 });
    expect((await pay(second.body.id)).status).toBe(200);
    expect(await stockOf(popcornA.id)).toBe(4);
  });

  it('10 orders paid at the same instant against 5 units: exactly 5 succeed, stock ends at 0, never negative', async () => {
    const { popcornA } = await seedWorld({ stockA: 5, minimum: 1 });
    const orders = [];
    for (let i = 0; i < 10; i += 1) {
      orders.push((await placeOrder([{ combo_id: 1, quantity: 1 }])).body);
    }
    const results = await Promise.all(orders.map((o) => pay(o.id)));

    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    const refused = results.filter((r) => r.status === 409);
    expect(refused).toHaveLength(5);
    expect(refused.every((r) => r.body.code === 'INSUFFICIENT_STOCK')).toBe(true);

    expect(await stockOf(popcornA.id)).toBe(0);
    expect(await InventoryTransaction.countDocuments({ type: 'SALE' })).toBe(5);
    expect(await ComboOrder.countDocuments({ status: 'PAID' })).toBe(5);
    expect(await ComboOrder.countDocuments({ status: 'PENDING' })).toBe(5);
  });
});

describe('Cancelling a sale returns stock', () => {
  it('cancelling a PAID order restocks it (RETURN) and a second cancel is refused without double-restocking', async () => {
    const { popcornA } = await seedWorld();
    const created = await placeOrder([{ combo_id: 1, quantity: 5 }]);
    await pay(created.body.id);
    expect(await stockOf(popcornA.id)).toBe(45);

    const cancelled = await request(app)
      .post(`/api/combo-orders/${created.body.id}/cancel`)
      .set('Authorization', STAFF)
      .send({ reason: 'customer left' });
    expect(cancelled.status).toBe(200);
    expect(await stockOf(popcornA.id)).toBe(50);

    const history = await request(app).get(`/api/inventory/${popcornA.id}/history?type=RETURN`).set('Authorization', ADMIN_A);
    expect(history.body.total).toBe(1);
    expect(history.body.data[0]).toMatchObject({ type: 'RETURN', quantity_change: 5, performed_by: STAFF_ID });

    const again = await request(app).post(`/api/combo-orders/${created.body.id}/cancel`).set('Authorization', STAFF).send({});
    expect(again.status).toBe(400);
    expect(await stockOf(popcornA.id)).toBe(50);
  });

  it('cancelling a PENDING order changes nothing (it never took stock)', async () => {
    const { popcornA } = await seedWorld();
    const created = await placeOrder([{ combo_id: 1, quantity: 5 }]);
    await request(app).post(`/api/combo-orders/${created.body.id}/cancel`).set('Authorization', STAFF).send({});
    expect(await stockOf(popcornA.id)).toBe(50);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });
});

describe('LOW_STOCK', () => {
  it('a sale that brings stock to the minimum flips the item to LOW_STOCK and lists it in alerts', async () => {
    const { popcornA } = await seedWorld({ stockA: 15, minimum: 10 });
    expect((await Inventory.findOne({ id: popcornA.id })).status).toBe('IN_STOCK');

    const created = await placeOrder([{ combo_id: 1, quantity: 5 }]);
    await pay(created.body.id); // 15 -> 10 == minimum

    expect((await Inventory.findOne({ id: popcornA.id })).status).toBe('LOW_STOCK');
    const low = await request(app).get('/api/inventory?status=LOW_STOCK').set('Authorization', ADMIN_A);
    expect(low.body.data.map((i) => i.id)).toEqual([popcornA.id]);
    const alerts = await request(app).get('/api/inventory/alerts').set('Authorization', ADMIN_A);
    expect(alerts.body.map((i) => i.id)).toEqual([popcornA.id]);
  });

  it('an import that lifts stock above the minimum clears LOW_STOCK', async () => {
    const { popcornA } = await seedWorld({ stockA: 5, minimum: 10 });
    expect((await Inventory.findOne({ id: popcornA.id })).status).toBe('LOW_STOCK');
    await request(app).post(`/api/inventory/${popcornA.id}/import`).set('Authorization', ADMIN_A).send({ quantity: 10 });
    expect((await Inventory.findOne({ id: popcornA.id })).status).toBe('IN_STOCK');
  });
});

describe('Branch isolation', () => {
  it('each branch has its own stock: a sale at Branch A never touches Branch B', async () => {
    const { popcornA, popcornB } = await seedWorld();
    const created = await placeOrder([{ combo_id: 1, quantity: 7 }]);
    await pay(created.body.id);
    expect(await stockOf(popcornA.id)).toBe(43);
    expect(await stockOf(popcornB.id)).toBe(50);
  });

  it('a Branch Admin lists only their own branch\'s inventory', async () => {
    const { popcornA, popcornB } = await seedWorld();
    const a = await request(app).get('/api/inventory').set('Authorization', ADMIN_A);
    expect(a.body.data.map((i) => i.id)).toEqual([popcornA.id]);
    const b = await request(app).get('/api/inventory').set('Authorization', ADMIN_B);
    expect(b.body.data.map((i) => i.id)).toEqual([popcornB.id]);
    const sa = await request(app).get('/api/inventory').set('Authorization', SUPER);
    expect(sa.body.total).toBe(2);
  });

  it('a Branch Admin cannot view another branch\'s inventory (list, alerts, detail, history, categories)', async () => {
    const { popcornB } = await seedWorld({ stockB: 1, minimum: 10 });
    const get = (path) => request(app).get(path).set('Authorization', ADMIN_A);
    expect((await get('/api/inventory?branchId=2')).status).toBe(403);
    expect((await get('/api/inventory/alerts?branchId=2')).status).toBe(403);
    expect((await get('/api/inventory/categories?branchId=2')).status).toBe(403);
    expect((await get(`/api/inventory/${popcornB.id}`)).status).toBe(403);
    expect((await get(`/api/inventory/${popcornB.id}/history`)).status).toBe(403);
    // ...and Branch B's low stock does not leak into Branch A's own alert feed.
    expect((await get('/api/inventory/alerts')).body).toEqual([]);
  });

  it('a Branch Admin cannot modify another branch\'s inventory (create, update, delete, every stock movement)', async () => {
    const { popcornB } = await seedWorld();
    const as = (method, path, body = {}) => request(app)[method](path).set('Authorization', ADMIN_A).send(body);

    expect((await as('post', '/api/inventory', { branch_id: 2, item: 'Hack', unit: 'pcs' })).status).toBe(403);
    expect((await as('put', `/api/inventory/${popcornB.id}`, { item: 'Hacked' })).status).toBe(403);
    expect((await as('delete', `/api/inventory/${popcornB.id}`)).status).toBe(403);
    for (const action of ['import', 'return', 'adjust', 'waste']) {
      expect((await as('post', `/api/inventory/${popcornB.id}/${action}`, { quantity: 1 })).status).toBe(403);
    }

    const untouched = await Inventory.findOne({ id: popcornB.id });
    expect(untouched).toMatchObject({ item: 'Popcorn', quantity: 50, branch_id: 2 });
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });

  it('cannot re-home an item to another branch through the update body', async () => {
    const { popcornA } = await seedWorld();
    const res = await request(app)
      .put(`/api/inventory/${popcornA.id}`)
      .set('Authorization', ADMIN_A)
      .send({ branch_id: 2, quantity: 9999, selling_price: 10 });
    expect(res.status).toBe(200);
    expect(await Inventory.findOne({ id: popcornA.id })).toMatchObject({ branch_id: 1, quantity: 50, selling_price: 10 });
  });

  it('cannot link a stock record to another branch\'s combo', async () => {
    await seedWorld();
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', ADMIN_A)
      .send({ branch_id: 1, item: 'Cross', unit: 'pcs', combo_id: 11 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('COMBO_BRANCH_MISMATCH');
  });

  it('staff can read only their own branch\'s stock and cannot change it', async () => {
    const { popcornA, popcornB } = await seedWorld();
    const list = await request(app).get('/api/inventory').set('Authorization', STAFF);
    expect(list.status).toBe(200);
    expect(list.body.data.map((i) => i.id)).toEqual([popcornA.id]);
    expect((await request(app).get(`/api/inventory/${popcornB.id}`).set('Authorization', STAFF)).status).toBe(403);
    expect(
      (await request(app).post(`/api/inventory/${popcornA.id}/import`).set('Authorization', STAFF).send({ quantity: 5 })).status,
    ).toBe(403);
  });

  it('staff cannot sell for a branch they do not work at', async () => {
    await seedWorld();
    expect((await placeOrder([{ combo_id: 11, quantity: 1 }], STAFF, 2)).status).toBe(403);
  });
});

describe('Inventory validation over HTTP', () => {
  const create = (body, auth = ADMIN_A) =>
    request(app).post('/api/inventory').set('Authorization', auth).send({ branch_id: 1, unit: 'pcs', ...body });

  it('creates a product with the full catalogue and normalises the SKU', async () => {
    await seedWorld();
    const res = await create({ item: 'Nachos', sku: ' nch-01 ', category: 'Food', cost_price: 12000, selling_price: 30000, quantity: 10, minimum_quantity: 3 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      item: 'Nachos', sku: 'NCH-01', category: 'Food', cost_price: 12000, selling_price: 30000,
      quantity: 10, minimum_quantity: 3, unit: 'pcs', status: 'IN_STOCK', branch_id: 1,
    });
  });

  it.each([
    ['missing item', { item: '' }],
    ['unit too long', { item: 'X', unit: 'u'.repeat(21) }],
    ['negative quantity', { item: 'X', quantity: -1 }],
    ['non-numeric quantity', { item: 'X', quantity: 'abc' }],
    ['infinite quantity', { item: 'X', quantity: 'Infinity' }],
    ['huge quantity', { item: 'X', quantity: 1e12 }],
    ['negative minimum', { item: 'X', minimum_quantity: -5 }],
    ['negative cost price', { item: 'X', cost_price: -1 }],
    ['negative selling price', { item: 'X', selling_price: -1 }],
    ['NaN selling price', { item: 'X', selling_price: 'free' }],
    ['SKU with spaces', { item: 'X', sku: 'a b' }],
    ['SKU with symbols', { item: 'X', sku: 'a$b' }],
    ['SKU too long', { item: 'X', sku: 'A'.repeat(41) }],
    ['category too long', { item: 'X', category: 'c'.repeat(61) }],
    ['non-integer combo_id', { item: 'X', combo_id: 'abc' }],
  ])('rejects %s with 400', async (_label, body) => {
    await seedWorld();
    const res = await create(body);
    expect(res.status).toBe(400);
    expect(await Inventory.countDocuments({ item: 'X' })).toBe(0);
  });

  it('reports duplicates as translatable 409s: name, SKU, and double-tracked combo', async () => {
    await seedWorld();
    const dupName = await create({ item: 'Popcorn' });
    expect(dupName.status).toBe(409);
    expect(dupName.body.code).toBe('DUPLICATE_ITEM');

    await create({ item: 'Nachos', sku: 'N1' });
    const dupSku = await create({ item: 'Other', sku: 'n1' });
    expect(dupSku.status).toBe(409);
    expect(dupSku.body.code).toBe('DUPLICATE_SKU');

    const dupCombo = await create({ item: 'Popcorn 2', combo_id: 1 });
    expect(dupCombo.status).toBe(409);
    expect(dupCombo.body.code).toBe('COMBO_ALREADY_TRACKED');
  });

  it('rejects linking a COMBO bundle or a missing combo', async () => {
    await seedWorld();
    const bundle = await create({ item: 'Bundle', combo_id: 3 });
    expect(bundle.status).toBe(400);
    expect(bundle.body.code).toBe('COMBO_NOT_STOCKABLE');
    const missing = await create({ item: 'Ghost', combo_id: 999 });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('COMBO_NOT_FOUND');
  });

  it('two branches may use the same name and SKU independently', async () => {
    await seedWorld();
    await create({ item: 'Nachos', sku: 'N1' });
    const other = await create({ item: 'Nachos', sku: 'N1', branch_id: 2 }, ADMIN_B);
    expect(other.status).toBe(201);
  });

  it('stock actions validate quantity: zero/negative/NaN/Infinity/too-long reason are 400, adjust accepts 0', async () => {
    const { popcornA } = await seedWorld();
    const act = (action, body) =>
      request(app).post(`/api/inventory/${popcornA.id}/${action}`).set('Authorization', ADMIN_A).send(body);

    for (const action of ['import', 'return', 'waste']) {
      expect((await act(action, { quantity: 0 })).status).toBe(400);
      expect((await act(action, { quantity: -3 })).status).toBe(400);
      expect((await act(action, { quantity: 'x' })).status).toBe(400);
      expect((await act(action, { quantity: 'Infinity' })).status).toBe(400);
      expect((await act(action, {})).status).toBe(400);
    }
    expect((await act('adjust', { quantity: -1 })).status).toBe(400);
    expect((await act('adjust', {})).status).toBe(400);
    expect((await act('import', { quantity: 1, reason: 'r'.repeat(501) })).status).toBe(400);
    expect(await stockOf(popcornA.id)).toBe(50);

    const zero = await act('adjust', { quantity: 0 });
    expect(zero.status).toBe(200);
    expect(zero.body.status).toBe('OUT_OF_STOCK');
  });

  it('waste beyond stock is 409 INSUFFICIENT_STOCK and changes nothing', async () => {
    const { popcornA } = await seedWorld({ stockA: 3 });
    const res = await request(app).post(`/api/inventory/${popcornA.id}/waste`).set('Authorization', ADMIN_A).send({ quantity: 4 });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_STOCK', requested: 4, available: 3 });
    expect(await stockOf(popcornA.id)).toBe(3);
  });

  it('each movement type lands in the history with its own type', async () => {
    const { popcornA } = await seedWorld();
    const act = (action, body) =>
      request(app).post(`/api/inventory/${popcornA.id}/${action}`).set('Authorization', ADMIN_A).send(body);
    await act('import', { quantity: 10, reason: 'delivery' });
    await act('return', { quantity: 2 });
    await act('waste', { quantity: 3, reason: 'expired' });
    await act('adjust', { quantity: 40, reason: 'stocktake' });

    const history = await request(app).get(`/api/inventory/${popcornA.id}/history`).set('Authorization', ADMIN_A);
    expect(history.body.data.map((t) => t.type).sort()).toEqual(['ADJUSTMENT', 'IMPORT', 'RETURN', 'WASTE']);
    const onlyWaste = await request(app).get(`/api/inventory/${popcornA.id}/history?type=WASTE`).set('Authorization', ADMIN_A);
    expect(onlyWaste.body.total).toBe(1);
  });

  it('PUT edits catalogue fields, validates them, and recomputes status against the live quantity', async () => {
    const { popcornA } = await seedWorld({ stockA: 20, minimum: 5 });
    const put = (body) => request(app).put(`/api/inventory/${popcornA.id}`).set('Authorization', ADMIN_A).send(body);

    const ok = await put({ sku: 'pop-1', category: 'Food', cost_price: 1, selling_price: 2, minimum_quantity: 25 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ sku: 'POP-1', category: 'Food', status: 'LOW_STOCK', quantity: 20 });

    expect((await put({ selling_price: -1 })).status).toBe(400);
    expect((await put({ item: '' })).status).toBe(400);
    expect((await put({ combo_id: 3 })).status).toBe(400);
    const unlink = await put({ combo_id: null });
    expect(unlink.body.combo_id).toBeNull();
    expect((await request(app).put('/api/inventory/999').set('Authorization', SUPER).send({ item: 'x' })).status).toBe(404);
  });

  it('list supports search and category filters', async () => {
    await seedWorld();
    await create({ item: 'Pepsi', sku: 'PEPSI', category: 'Beverage' });
    const byCategory = await request(app).get('/api/inventory?category=Beverage').set('Authorization', ADMIN_A);
    expect(byCategory.body.data.map((i) => i.item)).toEqual(['Pepsi']);
    const bySearch = await request(app).get('/api/inventory?q=pep').set('Authorization', ADMIN_A);
    expect(bySearch.body.data.map((i) => i.item)).toEqual(['Pepsi']);
    const categories = await request(app).get('/api/inventory/categories').set('Authorization', ADMIN_A);
    expect(categories.body).toEqual(['Beverage']);
  });
});
