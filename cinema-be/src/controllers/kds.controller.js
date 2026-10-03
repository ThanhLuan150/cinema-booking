const ComboOrder = require('../models/ComboOrder');
const comboOrderRepository = require('../repositories/comboOrder.repository');
const bookingRepository = require('../repositories/booking.repository');
const cashierShiftService = require('../services/cashierShift.service');
const kdsService = require('../services/kds.service');
const { REALTIME_ACTION } = require('../utils/realtimeEvents');
const {
  KDS_STATUS,
  KDS_TRANSITIONS,
  toKdsStatus,
  canTransition,
  parseKdsStatuses,
  validateStatusUpdate,
} = require('../utils/kdsStatus');

function fail(res, status, code, message, extra = {}) {
  return res.status(status).json({ message, code, ...extra });
}

// Each KDS step is one of the existing atomic, status-guarded ComboOrder transitions — the guard in
// the filter is what makes two staff tapping the same card at once safe (exactly one wins). Nothing
// here can touch items or prices: the updates only $set a status and its timestamp.
const PERFORM = {
  [KDS_STATUS.PREPARING]: (order) => comboOrderRepository.markPreparing(order.id),
  [KDS_STATUS.READY]: (order) => comboOrderRepository.markReady(order.id),
  [KDS_STATUS.COMPLETED]: (order) => comboOrderRepository.markDelivered(order.id),
  [KDS_STATUS.CANCELLED]: (order, { reason, accountId }) =>
    comboOrderRepository.cancel(order.id, reason, {
      performedBy: accountId,
      // Only what is on the KDS (paid, not yet made) — never a PENDING order.
      fromStatuses: [ComboOrder.STATUS.PAID, ComboOrder.STATUS.PREPARING],
    }),
};

// GET /api/kds/branches -> the branches whose KDS the caller may open, with their waiting-order counts.
// ALL scope (Super Admin): every branch. BRANCH scope: the branch an Employee is staffed at (or the
// branches an owner owns) — the same set requireBranchAccess would let them open.
async function listBranches(req, res) {
  const branchIds =
    req.permissionScope === 'ALL'
      ? null
      : await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
  res.json(await kdsService.listBranches({ branchIds }));
}

// GET /api/kds/branches/:branchId/orders?status=NEW,PREPARING&recentMinutes=60
// requireBranchAccess already pinned the caller to :branchId (req.branchId), so the board can only
// ever be the branch they work at (or own; any branch for the Super Admin).
async function getBoard(req, res) {
  const parsed = parseKdsStatuses(req.query.status);
  if (parsed.error) {
    return fail(
      res,
      400,
      parsed.error.code,
      `Unknown KDS status: ${parsed.error.invalid.join(', ')}`,
      {
        invalid: parsed.error.invalid,
      },
    );
  }
  const board = await kdsService.getBoard(req.branchId, {
    statuses: parsed.statuses,
    recentMinutes: req.query.recentMinutes,
  });
  res.json(board);
}

// PATCH /api/kds/branches/:branchId/orders/:id/status { status, reason? }
async function updateStatus(req, res) {
  const parsed = validateStatusUpdate(req.body);
  if (parsed.error) {
    const { code, message, ...extra } = parsed.error;
    return fail(res, 400, code, message, extra);
  }

  const order = await comboOrderRepository.findById(req.params.id);
  if (!order) return fail(res, 404, 'KDS_ORDER_NOT_FOUND', 'Order not found');
  // This KDS belongs to :branchId. Even a caller who may also access the order's own branch (the
  // Super Admin, an owner of several) cannot process it from another branch's screen.
  if (order.branch_id !== req.branchId) {
    return fail(res, 403, 'KDS_BRANCH_MISMATCH', 'This order belongs to another branch');
  }

  const current = toKdsStatus(order);
  if (!current) {
    return fail(res, 409, 'KDS_ORDER_NOT_PAID', 'Only a paid order is on the Kitchen Display', {
      current_status: order.status,
    });
  }
  if (!canTransition(current, parsed.status)) {
    return fail(
      res,
      409,
      'INVALID_KDS_TRANSITION',
      `Cannot move an order from ${current} to ${parsed.status}`,
      {
        from: current,
        to: parsed.status,
        allowed: KDS_TRANSITIONS[current],
      },
    );
  }

  if (
    parsed.status === KDS_STATUS.CANCELLED &&
    (await cashierShiftService.isTransactionLocked(order.shift_id))
  ) {
    return fail(
      res,
      409,
      'SHIFT_CLOSED',
      'This order was paid in a shift that is already closed and can no longer be changed',
    );
  }

  const updated = await PERFORM[parsed.status](order, {
    reason: parsed.reason,
    accountId: req.account?.accountId ?? null,
  });
  if (!updated) {
    // Lost a race: someone else moved the order between our read and our guarded write.
    const latest = await comboOrderRepository.findById(order.id);
    return fail(
      res,
      409,
      'KDS_STATUS_CONFLICT',
      'The order was updated by someone else — refresh and try again',
      {
        current_status: toKdsStatus(latest),
      },
    );
  }

  comboOrderRepository.broadcastOrder(updated, REALTIME_ACTION.STATUS_CHANGED);
  res.json(await kdsService.present(updated));
}

module.exports = { listBranches, getBoard, updateStatus };
