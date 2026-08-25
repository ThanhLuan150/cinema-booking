const comboOrderRepository = require('../repositories/comboOrder.repository');
const comboRepository = require('../repositories/combo.repository');
const bookingRepository = require('../repositories/booking.repository');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// BRANCH: caller must have access to the order's branch (owner or staffed employee, same as
// booking/refund). ALL: no restriction. There is no OWN scope — combo orders are staff-created
// (combo.sell/combo.order.*), never something a customer holds a permission over directly.
async function canAccessOrder(req, order) {
  if (req.permissionScope === 'ALL') return true;
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    return branchIds.includes(order.branch_id);
  }
  return false;
}

// POST /api/combo-orders { branch_id, account_id?, booking_id?, items: [{ combo_id, quantity }] }
// Combo Staff/Cashier "sell a combo" action (combo.sell permission, branch-scoped via
// requireBranchAccess). account_id is optional (anonymous walk-up sale); booking_id optionally
// links the order to a customer's existing booking at the same branch.
async function createOrder(req, res) {
  const { account_id, booking_id, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items is required' });
  }

  const combos = await comboRepository.findByIds(items.map((entry) => entry.combo_id));
  const comboById = new Map(combos.map((c) => [c.id, c]));

  const orderItems = [];
  for (const entry of items) {
    const combo = comboById.get(Number(entry.combo_id));
    if (!combo) {
      return res.status(400).json({ message: `Combo ${entry.combo_id} not found`, code: 'COMBO_NOT_FOUND' });
    }
    if (combo.cinema_id !== req.branchId) {
      return res.status(400).json({ message: `Combo ${combo.id} does not belong to this branch`, code: 'COMBO_BRANCH_MISMATCH' });
    }
    if (!combo.active) {
      return res.status(400).json({ message: `Combo ${combo.id} is not active`, code: 'COMBO_INACTIVE' });
    }
    const quantity = Number(entry.quantity) || 0;
    if (quantity <= 0) {
      return res.status(400).json({ message: `quantity for combo ${combo.id} must be positive` });
    }
    orderItems.push({
      combo_id: combo.id,
      name: combo.name,
      unit_price: combo.price,
      quantity,
      line_total: combo.price * quantity,
    });
  }

  if (booking_id) {
    const booking = await bookingRepository.findBookingById(booking_id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.branch_id !== req.branchId) {
      return res.status(400).json({ message: 'Booking does not belong to this branch', code: 'BOOKING_BRANCH_MISMATCH' });
    }
  }

  const totalPrice = orderItems.reduce((sum, item) => sum + item.line_total, 0);
  const order = await comboOrderRepository.createOrder({
    branchId: req.branchId,
    accountId: account_id ? Number(account_id) : null,
    bookingId: booking_id ? Number(booking_id) : null,
    items: orderItems,
    totalPrice,
    createdBy: req.account.accountId,
  });
  res.status(201).json(order);
}

// GET /api/combo-orders?status=&branchId=&page=&limit= -> orders visible to the caller, scoped
// by combo.order.view's BRANCH/ALL
async function listOrders(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    filter.branch_id = { $in: branchIds };
  } else if (req.query.branchId) {
    filter.branch_id = Number(req.query.branchId);
  }
  if (req.query.status) filter.status = req.query.status;

  const { data, total } = await comboOrderRepository.listAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/combo-orders/:id
async function getOrderById(req, res) {
  const order = await comboOrderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Combo order not found' });
  if (!(await canAccessOrder(req, order))) return res.status(403).json({ message: 'Forbidden' });
  res.json(order);
}

// POST /api/combo-orders/:id/pay { method: 'CASH' | 'MOMO' } -> PENDING -> PAID (payment.create permission)
async function payOrder(req, res) {
  const order = await comboOrderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Combo order not found' });
  if (!(await canAccessOrder(req, order))) return res.status(403).json({ message: 'Forbidden' });

  const method = req.body?.method === 'MOMO' ? 'MOMO' : 'CASH';
  const updated = await comboOrderRepository.markPaid(order.id, method);
  if (!updated) {
    return res.status(400).json({
      message: `Only a PENDING order can be paid (current status: ${order.status})`,
      code: 'ORDER_NOT_PENDING',
    });
  }
  res.json(updated);
}

// POST /api/combo-orders/:id/prepare -> PAID -> PREPARING
async function prepareOrder(req, res) {
  const order = await comboOrderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Combo order not found' });
  if (!(await canAccessOrder(req, order))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await comboOrderRepository.markPreparing(order.id);
  if (!updated) {
    return res.status(400).json({
      message: `Only a PAID order can start preparing (current status: ${order.status})`,
      code: 'ORDER_NOT_PAID',
    });
  }
  res.json(updated);
}

// POST /api/combo-orders/:id/ready -> PREPARING -> READY
async function readyOrder(req, res) {
  const order = await comboOrderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Combo order not found' });
  if (!(await canAccessOrder(req, order))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await comboOrderRepository.markReady(order.id);
  if (!updated) {
    return res.status(400).json({
      message: `Only a PREPARING order can be marked ready (current status: ${order.status})`,
      code: 'ORDER_NOT_PREPARING',
    });
  }
  res.json(updated);
}

// POST /api/combo-orders/:id/deliver -> READY -> DELIVERED
async function deliverOrder(req, res) {
  const order = await comboOrderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Combo order not found' });
  if (!(await canAccessOrder(req, order))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await comboOrderRepository.markDelivered(order.id);
  if (!updated) {
    return res.status(400).json({
      message: `Only a READY order can be delivered (current status: ${order.status})`,
      code: 'ORDER_NOT_READY',
    });
  }
  res.json(updated);
}

// POST /api/combo-orders/:id/cancel { reason } -> PENDING/PAID/PREPARING -> CANCELLED
async function cancelOrder(req, res) {
  const order = await comboOrderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Combo order not found' });
  if (!(await canAccessOrder(req, order))) return res.status(403).json({ message: 'Forbidden' });

  const updated = await comboOrderRepository.cancel(order.id, req.body?.reason);
  if (!updated) {
    return res.status(400).json({
      message: `Order cannot be cancelled from status ${order.status}`,
      code: 'ORDER_NOT_CANCELLABLE',
    });
  }
  res.json(updated);
}

module.exports = {
  canAccessOrder,
  createOrder,
  listOrders,
  getOrderById,
  payOrder,
  prepareOrder,
  readyOrder,
  deliverOrder,
  cancelOrder,
};
