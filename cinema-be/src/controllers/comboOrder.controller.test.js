const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const comboOrderController = require('./comboOrder.controller');
const comboOrderRepository = require('../repositories/comboOrder.repository');
const Combo = require('../models/Combo');
const Branch = require('../models/Branch');
const Booking = require('../models/Booking');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('comboOrder.controller createOrder', () => {
  it('rejects an empty items array', async () => {
    const res = mockRes();
    await comboOrderController.createOrder({ body: { items: [] }, branchId: 1, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an unknown combo id', async () => {
    const res = mockRes();
    await comboOrderController.createOrder(
      { body: { items: [{ combo_id: 999, quantity: 1 }] }, branchId: 1, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'COMBO_NOT_FOUND' }));
  });

  it('rejects a combo that belongs to a different branch', async () => {
    await Combo.create({ id: 1, cinema_id: 2, name: 'Popcorn', price: 50000, active: true });
    const res = mockRes();
    await comboOrderController.createOrder(
      { body: { items: [{ combo_id: 1, quantity: 1 }] }, branchId: 1, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'COMBO_BRANCH_MISMATCH' }));
  });

  it('rejects an inactive combo', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn', price: 50000, active: false });
    const res = mockRes();
    await comboOrderController.createOrder(
      { body: { items: [{ combo_id: 1, quantity: 1 }] }, branchId: 1, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'COMBO_INACTIVE' }));
  });

  it('rejects a non-positive quantity', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn', price: 50000, active: true });
    const res = mockRes();
    await comboOrderController.createOrder(
      { body: { items: [{ combo_id: 1, quantity: 0 }] }, branchId: 1, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates an order with computed line totals across multiple items', async () => {
    await Combo.create([
      { id: 1, cinema_id: 1, name: 'Popcorn Combo', price: 50000, active: true },
      { id: 2, cinema_id: 1, name: 'Coke', price: 20000, active: true, type: 'BEVERAGE' },
    ]);
    const res = mockRes();
    await comboOrderController.createOrder(
      {
        body: {
          account_id: 7,
          items: [
            { combo_id: 1, quantity: 2 },
            { combo_id: 2, quantity: 3 },
          ],
        },
        branchId: 1,
        account: { accountId: 99 },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const [order] = res.json.mock.calls[0];
    expect(order.total_price).toBe(50000 * 2 + 20000 * 3);
    expect(order.account_id).toBe(7);
    expect(order.created_by).toBe(99);
    expect(order.status).toBe('PENDING');
  });

  it('rejects an unknown booking_id', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn', price: 50000, active: true });
    const res = mockRes();
    await comboOrderController.createOrder(
      { body: { items: [{ combo_id: 1, quantity: 1 }], booking_id: 999 }, branchId: 1, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects a booking that belongs to a different branch', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn', price: 50000, active: true });
    await Booking.create({
      id: 1,
      code: 'BK-1',
      account_id: 7,
      schedule_id: 1,
      branch_id: 2,
      total_price: 100000,
    });
    const res = mockRes();
    await comboOrderController.createOrder(
      { body: { items: [{ combo_id: 1, quantity: 1 }], booking_id: 1 }, branchId: 1, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BOOKING_BRANCH_MISMATCH' }));
  });

  it('links the order to a booking at the same branch', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn', price: 50000, active: true });
    await Booking.create({
      id: 1,
      code: 'BK-1',
      account_id: 7,
      schedule_id: 1,
      branch_id: 1,
      total_price: 100000,
    });
    const res = mockRes();
    await comboOrderController.createOrder(
      { body: { items: [{ combo_id: 1, quantity: 1 }], booking_id: 1 }, branchId: 1, account: { accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const [order] = res.json.mock.calls[0];
    expect(order.booking_id).toBe(1);
  });
});

describe('comboOrder.controller access scoping', () => {
  it('listOrders scopes a BRANCH-permission caller to their own accessible branches', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await comboOrderRepository.createOrder({
      branchId: 1,
      items: [{ combo_id: 1, name: 'A', unit_price: 1, quantity: 1, line_total: 1 }],
      totalPrice: 1,
    });
    await comboOrderRepository.createOrder({
      branchId: 2,
      items: [{ combo_id: 1, name: 'A', unit_price: 1, quantity: 1, line_total: 1 }],
      totalPrice: 1,
    });

    const res = mockRes();
    await comboOrderController.listOrders(
      { query: {}, permissionScope: 'BRANCH', account: { accountId: 42 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('listOrders returns everything for ALL scope', async () => {
    await comboOrderRepository.createOrder({
      branchId: 1,
      items: [{ combo_id: 1, name: 'A', unit_price: 1, quantity: 1, line_total: 1 }],
      totalPrice: 1,
    });
    await comboOrderRepository.createOrder({
      branchId: 2,
      items: [{ combo_id: 1, name: 'A', unit_price: 1, quantity: 1, line_total: 1 }],
      totalPrice: 1,
    });

    const res = mockRes();
    await comboOrderController.listOrders({ query: {}, permissionScope: 'ALL', account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('getOrderById returns 404 for an unknown order', async () => {
    const res = mockRes();
    await comboOrderController.getOrderById({ params: { id: 999 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getOrderById returns 403 when the BRANCH-scoped caller has no access to the branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const order = await comboOrderRepository.createOrder({
      branchId: 1,
      items: [{ combo_id: 1, name: 'A', unit_price: 1, quantity: 1, line_total: 1 }],
      totalPrice: 1,
    });
    const res = mockRes();
    await comboOrderController.getOrderById(
      { params: { id: order.id }, permissionScope: 'BRANCH', account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('comboOrder.controller order lifecycle', () => {
  async function createPendingOrder() {
    return comboOrderRepository.createOrder({
      branchId: 1,
      items: [{ combo_id: 1, name: 'A', unit_price: 1, quantity: 1, line_total: 1 }],
      totalPrice: 1,
    });
  }

  it('payOrder returns 404 for an unknown order', async () => {
    const res = mockRes();
    await comboOrderController.payOrder({ params: { id: 999 }, permissionScope: 'ALL', body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('payOrder moves PENDING -> PAID and rejects paying twice', async () => {
    const order = await createPendingOrder();

    const res1 = mockRes();
    await comboOrderController.payOrder(
      { params: { id: order.id }, permissionScope: 'ALL', body: { method: 'CASH' } },
      res1,
    );
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID', payment_method: 'CASH' }));

    const res2 = mockRes();
    await comboOrderController.payOrder(
      { params: { id: order.id }, permissionScope: 'ALL', body: { method: 'CASH' } },
      res2,
    );
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORDER_NOT_PENDING' }));
  });

  it('walks PAID -> PREPARING -> READY -> DELIVERED, each rejecting an out-of-order call', async () => {
    const order = await createPendingOrder();
    await comboOrderController.payOrder(
      { params: { id: order.id }, permissionScope: 'ALL', body: { method: 'CASH' } },
      mockRes(),
    );

    const readyTooSoon = mockRes();
    await comboOrderController.readyOrder({ params: { id: order.id }, permissionScope: 'ALL' }, readyTooSoon);
    expect(readyTooSoon.status).toHaveBeenCalledWith(400);
    expect(readyTooSoon.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORDER_NOT_PREPARING' }));

    const prepared = mockRes();
    await comboOrderController.prepareOrder({ params: { id: order.id }, permissionScope: 'ALL' }, prepared);
    expect(prepared.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PREPARING' }));

    const ready = mockRes();
    await comboOrderController.readyOrder({ params: { id: order.id }, permissionScope: 'ALL' }, ready);
    expect(ready.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'READY' }));

    const delivered = mockRes();
    await comboOrderController.deliverOrder({ params: { id: order.id }, permissionScope: 'ALL' }, delivered);
    expect(delivered.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'DELIVERED' }));
  });

  it('cancelOrder cancels a PENDING order but refuses once DELIVERED', async () => {
    const order = await createPendingOrder();
    const cancelled = mockRes();
    await comboOrderController.cancelOrder(
      { params: { id: order.id }, permissionScope: 'ALL', body: { reason: 'changed mind' } },
      cancelled,
    );
    expect(cancelled.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'CANCELLED', cancel_reason: 'changed mind' }));

    const delivered = await createPendingOrder();
    await comboOrderController.payOrder(
      { params: { id: delivered.id }, permissionScope: 'ALL', body: { method: 'CASH' } },
      mockRes(),
    );
    await comboOrderController.prepareOrder({ params: { id: delivered.id }, permissionScope: 'ALL' }, mockRes());
    await comboOrderController.readyOrder({ params: { id: delivered.id }, permissionScope: 'ALL' }, mockRes());
    await comboOrderController.deliverOrder({ params: { id: delivered.id }, permissionScope: 'ALL' }, mockRes());

    const rejected = mockRes();
    await comboOrderController.cancelOrder({ params: { id: delivered.id }, permissionScope: 'ALL', body: {} }, rejected);
    expect(rejected.status).toHaveBeenCalledWith(400);
    expect(rejected.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ORDER_NOT_CANCELLABLE' }));
  });
});
