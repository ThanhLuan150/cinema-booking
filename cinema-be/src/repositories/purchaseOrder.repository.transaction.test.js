// Runs against a single-node REPLICA SET so `receive` executes inside a real MongoDB transaction.
// With compensation disabled on that path (it only runs when there is no session), the only thing
// that can undo a half-applied receipt here is the transaction abort — which is what these prove.
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
  await connect({ replSet: true });
  // Collections must exist before a transaction touches them.
  for (const model of [PurchaseOrder, Inventory, InventoryTransaction]) {
    await model.init();
    await model.createCollection();
  }
  resetTransactionSupportCache();
});
afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
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

it('detects the replica set', async () => {
  expect(await supportsTransactions()).toBe(true);
});

describe('receive in a real transaction', () => {
  it('commits the status flip, every stock increment and every ledger row together', async () => {
    const { popcorn, cola, order } = await seed();
    const receiptSpy = jest.spyOn(inventoryRepository, 'receivePurchaseLine');

    const result = await purchaseOrderRepository.receive(order.id, { performedBy: 42 });

    expect(result.order.status).toBe('RECEIVED');
    // Proof it really ran transactionally: every line was applied with a live session.
    expect(receiptSpy).toHaveBeenCalledTimes(2);
    for (const [args] of receiptSpy.mock.calls) expect(args.session).toBeTruthy();
    expect(await stockOf(popcorn.id)).toBe(30);
    expect(await stockOf(cola.id)).toBe(10);
    expect((await Inventory.findOne({ id: cola.id })).status).toBe('IN_STOCK'); // 4 <= 5 (LOW) -> 10
    const rows = await InventoryTransaction.find({ ref_type: 'PURCHASE_ORDER' });
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.quantity_change).not.toBe(0); // settled, not left as a bare claim
  });

  it('rolls EVERYTHING back when a later line fails — the earlier line is not left applied', async () => {
    const { popcorn, cola, order } = await seed();
    const real = inventoryRepository.receivePurchaseLine;
    let calls = 0;
    jest.spyOn(inventoryRepository, 'receivePurchaseLine').mockImplementation(async (args) => {
      calls += 1;
      if (calls === 2) throw new Error('disk on fire');
      return real(args);
    });

    await expect(purchaseOrderRepository.receive(order.id, { performedBy: 42 })).rejects.toThrow('disk on fire');

    expect(calls).toBe(2);
    expect(await stockOf(popcorn.id)).toBe(10); // line 1 was applied, then rolled back by the abort
    expect(await stockOf(cola.id)).toBe(4);
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(0);
    const after = await PurchaseOrder.findOne({ id: order.id });
    expect(after.status).toBe('ORDERED');
    expect(after.received_at).toBeNull();

    // ...and the order is still receivable afterwards.
    jest.restoreAllMocks();
    const retry = await purchaseOrderRepository.receive(order.id, { performedBy: 42 });
    expect(retry.order.status).toBe('RECEIVED');
    expect(await stockOf(popcorn.id)).toBe(30);
  });

  it('rolls back when a product has vanished, reporting it instead of throwing', async () => {
    const { popcorn, cola, order } = await seed();
    await Inventory.deleteOne({ id: cola.id });

    const result = await purchaseOrderRepository.receive(order.id, { performedBy: 42 });

    expect(result).toEqual({ missingInventory: cola.id });
    expect(await stockOf(popcorn.id)).toBe(10);
    expect((await PurchaseOrder.findOne({ id: order.id })).status).toBe('ORDERED');
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(0);
  });

  it('does not broadcast anything for a receipt that rolled back', async () => {
    const socket = require('../utils/socket');
    const { order } = await seed();
    jest.spyOn(inventoryRepository, 'receivePurchaseLine').mockRejectedValue(new Error('boom'));
    await expect(purchaseOrderRepository.receive(order.id)).rejects.toThrow('boom');
    expect(socket.emitBranchEvent).not.toHaveBeenCalled();
  });

  it('concurrent receives of one order apply it exactly once', async () => {
    const { popcorn, order } = await seed();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => purchaseOrderRepository.receive(order.id, { performedBy: 42 })),
    );
    expect(results.filter((r) => r.order && !r.notReceivable)).toHaveLength(1);
    expect(results.filter((r) => r.notReceivable)).toHaveLength(4);
    expect(await stockOf(popcorn.id)).toBe(30);
    expect(await InventoryTransaction.countDocuments({ ref_type: 'PURCHASE_ORDER' })).toBe(2);
  });

  it('receive racing cancel: exactly one wins and stock agrees with the final status', async () => {
    for (let round = 0; round < 5; round += 1) {
      const { popcorn, order } = await seed();
      const [received, cancelled] = await Promise.all([
        purchaseOrderRepository.receive(order.id, { performedBy: 42 }),
        purchaseOrderRepository.cancel(order.id, { by: 42 }),
      ]);
      const final = await PurchaseOrder.findOne({ id: order.id });
      const stock = await stockOf(popcorn.id);
      if (final.status === 'RECEIVED') {
        expect(cancelled).toBeNull();
        expect(received.order).toBeTruthy();
        expect(stock).toBe(30);
      } else {
        expect(final.status).toBe('CANCELLED');
        expect(received.notReceivable).toBe(true);
        expect(stock).toBe(10); // a cancelled order must never leave stock behind
      }
      await clearDatabase();
    }
  });
});
