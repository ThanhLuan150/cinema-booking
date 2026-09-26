// Standalone mongod (no transactions): `receive` runs its fallback — guarded status gate, per-line
// idempotent ledger claims, and explicit compensation when a line fails part-way.
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const purchaseOrderRepository = require('./purchaseOrder.repository');
const inventoryRepository = require('./inventory.repository');
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const { supportsTransactions, resetTransactionSupportCache } = require('../utils/withTransaction');

jest.mock('../utils/socket', () => ({
  emitBranchEvent: jest.fn(),
  emitToAccount: jest.fn(),
  emitToAdmin: jest.fn(),
  emitToBranch: jest.fn(),
  emitToStaff: jest.fn(),
}));

beforeAll(async () => {
  await connect();
  await PurchaseOrder.init();
  await Inventory.init();
  await InventoryTransaction.init();
  resetTransactionSupportCache();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await clearDatabase();
});
afterAll(async () => closeDatabase());

async function seed() {
  const popcorn = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 10, minimumQuantity: 5, unit: 'kg' });
  const cola = await inventoryRepository.create({ branchId: 1, item: 'Cola', quantity: 4, minimumQuantity: 5, unit: 'can' });
  const order = await purchaseOrderRepository.create({
    supplierId: 1,
    branchId: 1,
    orderDate: new Date('2026-10-01'),
    expectedDate: null,
    note: '',
    items: [
      { inventory_id: popcorn.id, item: 'Popcorn', sku: null, unit: 'kg', quantity: 20, unit_cost: 5, line_total: 100 },
      { inventory_id: cola.id, item: 'Cola', sku: null, unit: 'can', quantity: 6, unit_cost: 2, line_total: 12 },
    ],
    totalAmount: 112,
    createdBy: 42,
  });
  await purchaseOrderRepository.confirm(order.id, { by: 42 });
  return { popcorn, cola, order };
}

const stockOf = async (id) => (await Inventory.findOne({ id })).quantity;

it('detects that this server has no transactions', async () => {
  expect(await supportsTransactions()).toBe(false);
});

describe('receive without transactions', () => {
  it('applies every line and marks the order RECEIVED', async () => {
    const { popcorn, cola, order } = await seed();
    const result = await purchaseOrderRepository.receive(order.id, { performedBy: 42 });
    expect(result.order.status).toBe('RECEIVED');
    expect(result.movements).toEqual([
      { inventoryId: popcorn.id, quantity: 20, before: 10, after: 30 },
      { inventoryId: cola.id, quantity: 6, before: 4, after: 10 },
    ]);
    expect(await stockOf(popcorn.id)).toBe(30);
    expect(await stockOf(cola.id)).toBe(10);
  });

  it('compensates when a later line fails: earlier stock, ledger rows and the status are restored', async () => {
    const { popcorn, cola, order } = await seed();
    const real = inventoryRepository.receivePurchaseLine;
    let calls = 0;
    jest.spyOn(inventoryRepository, 'receivePurchaseLine').mockImplementation(async (args) => {
      calls += 1;
      if (calls === 2) throw new Error('disk on fire');
      return real(args);
    });

    await expect(purchaseOrderRepository.receive(order.id, { performedBy: 42 })).rejects.toThrow('disk on fire');

    expect(await stockOf(popcorn.id)).toBe(10);
    expect(await stockOf(cola.id)).toBe(4);
    expect((await Inventory.findOne({ id: popcorn.id })).status).toBe('IN_STOCK');
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(0);
    const after = await PurchaseOrder.findOne({ id: order.id });
    expect(after.status).toBe('ORDERED');
    expect(after.received_at).toBeNull();
    expect(after.received_by).toBeNull();

    jest.restoreAllMocks();
    const retry = await purchaseOrderRepository.receive(order.id, { performedBy: 42 });
    expect(retry.order.status).toBe('RECEIVED');
    expect(await stockOf(popcorn.id)).toBe(30);
  });

  it('compensates a line whose stock landed but whose ledger row could not be settled', async () => {
    const { popcorn, order } = await seed();
    const realUpdateOne = InventoryTransaction.updateOne.bind(InventoryTransaction);
    let failedOnce = false;
    jest.spyOn(InventoryTransaction, 'updateOne').mockImplementation((...args) => {
      if (!failedOnce) {
        failedOnce = true;
        return Promise.reject(new Error('settle failed'));
      }
      return realUpdateOne(...args);
    });

    await expect(purchaseOrderRepository.receive(order.id, { performedBy: 42 })).rejects.toThrow('settle failed');

    // The increment that landed before the settle failure is taken back out again.
    expect(await stockOf(popcorn.id)).toBe(10);
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(0);
    expect((await PurchaseOrder.findOne({ id: order.id })).status).toBe('ORDERED');
  });

  it('a compensation never drives stock negative if the added units were sold meanwhile', async () => {
    const { popcorn, order } = await seed();
    const real = inventoryRepository.receivePurchaseLine;
    let calls = 0;
    jest.spyOn(inventoryRepository, 'receivePurchaseLine').mockImplementation(async (args) => {
      calls += 1;
      if (calls === 2) {
        // Everything on the shelf (10 + 20) sells before the failure is compensated.
        await inventoryRepository.wasteStock(popcorn.id, { quantity: 30, reason: 'sold', performedBy: 1 });
        throw new Error('boom');
      }
      return real(args);
    });

    await expect(purchaseOrderRepository.receive(order.id)).rejects.toThrow('boom');
    expect(await stockOf(popcorn.id)).toBe(0);
  });

  it('a stale ledger claim from an earlier attempt is not applied twice', async () => {
    const { popcorn, cola, order } = await seed();
    // An earlier attempt already added the popcorn line (stock 30) and its claim survived.
    await inventoryRepository.receivePurchaseLine({ order, line: order.items[0], performedBy: 42 });
    expect(await stockOf(popcorn.id)).toBe(30);

    const result = await purchaseOrderRepository.receive(order.id, { performedBy: 42 });

    expect(result.order.status).toBe('RECEIVED');
    expect(await stockOf(popcorn.id)).toBe(30); // not 50
    expect(await stockOf(cola.id)).toBe(10);
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(2);
  });

  it('reports a vanished product without leaving anything applied', async () => {
    const { popcorn, cola, order } = await seed();
    await Inventory.deleteOne({ id: cola.id });
    const result = await purchaseOrderRepository.receive(order.id);
    expect(result).toEqual({ missingInventory: cola.id });
    expect(await stockOf(popcorn.id)).toBe(10);
    expect((await PurchaseOrder.findOne({ id: order.id })).status).toBe('ORDERED');
  });

  it('concurrent receives apply the order exactly once', async () => {
    const { popcorn, order } = await seed();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => purchaseOrderRepository.receive(order.id, { performedBy: 42 })),
    );
    expect(results.filter((r) => !r.notReceivable)).toHaveLength(1);
    expect(await stockOf(popcorn.id)).toBe(30);
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(2);
  });

  it('a non-ORDERED order is reported, never received', async () => {
    const { popcorn, order } = await seed();
    await purchaseOrderRepository.cancel(order.id, { by: 42 });
    const result = await purchaseOrderRepository.receive(order.id);
    expect(result.notReceivable).toBe(true);
    expect(result.order.status).toBe('CANCELLED');
    expect(await stockOf(popcorn.id)).toBe(10);
  });
});
