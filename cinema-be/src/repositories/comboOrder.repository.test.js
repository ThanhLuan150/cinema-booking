const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const comboOrderRepository = require('./comboOrder.repository');
const inventoryRepository = require('./inventory.repository');
const ComboOrder = require('../models/ComboOrder');
const Combo = require('../models/Combo');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const items = [{ combo_id: 1, name: 'Popcorn Combo', unit_price: 50000, quantity: 2, line_total: 100000 }];

describe('comboOrder.repository', () => {
  it('createOrder assigns a sequential id and a CO- prefixed code, defaulting to PENDING', async () => {
    const order = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });
    expect(order.id).toBe(1);
    expect(order.code).toMatch(/^CO-\d+$/);
    expect(order.status).toBe('PENDING');
    expect(order.branch_id).toBe(1);
    expect(order.account_id).toBeNull();
    expect(order.booking_id).toBeNull();
  });

  it('createOrder stores the optional account/booking links', async () => {
    const order = await comboOrderRepository.createOrder({
      branchId: 1,
      accountId: 42,
      bookingId: 7,
      items,
      totalPrice: 100000,
      createdBy: 99,
    });
    expect(order.account_id).toBe(42);
    expect(order.booking_id).toBe(7);
    expect(order.created_by).toBe(99);
  });

  it('findById/findByCode return the matching order', async () => {
    const created = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });
    expect((await comboOrderRepository.findById(created.id)).id).toBe(created.id);
    expect((await comboOrderRepository.findByCode(created.code)).code).toBe(created.code);
    expect(await comboOrderRepository.findById(999)).toBeNull();
  });

  it('listAll filters and paginates', async () => {
    await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });
    await comboOrderRepository.createOrder({ branchId: 2, items, totalPrice: 100000 });
    const result = await comboOrderRepository.listAll({ branch_id: 1 });
    expect(result.total).toBe(1);
  });

  it('drives the full PENDING -> PAID -> PREPARING -> READY -> DELIVERED lifecycle', async () => {
    const order = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });

    const paid = await comboOrderRepository.markPaid(order.id, 'CASH');
    expect(paid.status).toBe('PAID');
    expect(paid.payment_method).toBe('CASH');
    expect(paid.paid_at).toBeInstanceOf(Date);

    const preparing = await comboOrderRepository.markPreparing(order.id);
    expect(preparing.status).toBe('PREPARING');

    const ready = await comboOrderRepository.markReady(order.id);
    expect(ready.status).toBe('READY');

    const delivered = await comboOrderRepository.markDelivered(order.id);
    expect(delivered.status).toBe('DELIVERED');
  });

  it('each transition is guarded and returns null from the wrong starting status', async () => {
    const order = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });

    expect(await comboOrderRepository.markPreparing(order.id)).toBeNull(); // still PENDING
    expect(await comboOrderRepository.markReady(order.id)).toBeNull();
    expect(await comboOrderRepository.markDelivered(order.id)).toBeNull();

    await comboOrderRepository.markPaid(order.id, 'CASH');
    expect(await comboOrderRepository.markPaid(order.id, 'CASH')).toBeNull(); // already PAID
  });

  it('cancel succeeds from PENDING/PAID/PREPARING but not from READY/DELIVERED', async () => {
    const pending = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });
    expect((await comboOrderRepository.cancel(pending.id, 'changed mind')).status).toBe('CANCELLED');

    const forReady = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });
    await comboOrderRepository.markPaid(forReady.id, 'CASH');
    await comboOrderRepository.markPreparing(forReady.id);
    await comboOrderRepository.markReady(forReady.id);
    expect(await comboOrderRepository.cancel(forReady.id, 'too late')).toBeNull();
  });

  it('cancel records the reason', async () => {
    const order = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });
    const cancelled = await comboOrderRepository.cancel(order.id, 'out of stock');
    expect(cancelled.cancel_reason).toBe('out of stock');
    expect(cancelled.cancelled_at).toBeInstanceOf(Date);
    expect(await ComboOrder.countDocuments({ status: 'CANCELLED' })).toBe(1);
  });
});

describe('comboOrder.repository markPaid inventory deduction', () => {
  it('deducts matching Inventory exactly once when an order is paid', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn Combo', price: 50000, type: 'FOOD' });
    const inventory = await inventoryRepository.create({
      branchId: 1,
      comboId: 1,
      item: 'Popcorn',
      quantity: 100,
      minimumQuantity: 10,
      unit: 'pcs',
    });
    const order = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });

    await comboOrderRepository.markPaid(order.id, 'CASH');
    expect((await inventoryRepository.findById(inventory.id)).quantity).toBe(98); // items[0].quantity is 2

    // A duplicate confirmation attempt (e.g. a retried payment callback) must not deduct again:
    // markPaid itself is guarded (order is no longer PENDING) so it never re-enters deduction.
    await comboOrderRepository.markPaid(order.id, 'CASH');
    expect((await inventoryRepository.findById(inventory.id)).quantity).toBe(98);
  });

  it('does not fail markPaid when no Inventory tracks the sold item', async () => {
    const order = await comboOrderRepository.createOrder({ branchId: 1, items, totalPrice: 100000 });
    const paid = await comboOrderRepository.markPaid(order.id, 'CASH');
    expect(paid.status).toBe('PAID');
  });
});
