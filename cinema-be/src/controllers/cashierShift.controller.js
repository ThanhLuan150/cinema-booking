const CashierShift = require('../models/CashierShift');
const cashierShiftRepository = require('../repositories/cashierShift.repository');
const employeeRepository = require('../repositories/employee.repository');
const bookingRepository = require('../repositories/booking.repository');
const cashierShiftService = require('../services/cashierShift.service');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// Every cash figure the client is allowed to send goes through this. `expected_cash` and
// `difference` are pointedly absent from the request bodies below: they are derived
// server-side at close time and silently ignored if a request tries to supply them
// ("Không cho Frontend tự quyết định expected_cash").
function parseMoney(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

// Scope gate shared by every read/close path.
// OWN: the caller's own shifts only (a cashier). BRANCH: any shift at a branch the caller
// owns or is staffed at (Branch Admin). ALL: the whole system (SUPER_ADMIN).
async function canAccessShift(req, shift) {
  if (req.permissionScope === 'ALL') return true;
  if (req.permissionScope === 'OWN') {
    const employee = await employeeRepository.findByAccountId(req.account.accountId);
    return Boolean(employee && employee.id === shift.employee_id);
  }
  if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    return branchIds.includes(shift.branch_id);
  }
  return false;
}

// POST /api/cashier-shifts/open { branch_id, opening_cash, note }
// The caller must hold cashierShift.open (CASHIER / TICKET_STAFF get it via their Position)
// and, through requireBranchAccess on the route, actually belong to branch_id — so a shift
// can never be opened against someone else's branch.
async function openShift(req, res) {
  const openingCash = parseMoney(req.body?.opening_cash);
  if (openingCash === undefined) {
    return res
      .status(400)
      .json({ message: 'opening_cash is required and must be a number >= 0', code: 'INVALID_OPENING_CASH' });
  }

  const employee = await employeeRepository.findByAccountId(req.account.accountId);
  if (!employee || employee.status !== 1) {
    return res
      .status(403)
      .json({ message: 'Only an active employee can open a cashier shift', code: 'NOT_AN_EMPLOYEE' });
  }
  // requireBranchAccess already proved the caller may act on req.branchId; this catches the
  // remaining case where the employee record itself belongs to a different branch.
  if (employee.branch_id !== req.branchId) {
    return res
      .status(403)
      .json({ message: 'Shift must belong to the branch you are staffed at', code: 'SHIFT_BRANCH_MISMATCH' });
  }

  let shift;
  try {
    shift = await cashierShiftRepository.open({
      employeeId: employee.id,
      accountId: req.account.accountId,
      branchId: employee.branch_id,
      openingCash,
      openedBy: req.account.accountId,
      note: req.body?.note || null,
    });
  } catch (err) {
    if (err instanceof cashierShiftRepository.ShiftAlreadyOpenError) {
      return res.status(409).json({ message: err.message, code: 'SHIFT_ALREADY_OPEN' });
    }
    throw err;
  }

  await recordAudit({
    req,
    action: ACTION.SHIFT_OPENED,
    entityType: ENTITY_TYPE.CASHIER_SHIFT,
    entityId: shift.id,
    branchId: shift.branch_id,
    metadata: { employeeId: shift.employee_id, openingCash: shift.opening_cash },
  });

  res.status(201).json(shift);
}

// POST /api/cashier-shifts/:id/close { actual_cash, note }
// actual_cash is the physical count. Everything else is recomputed here from the shift's own
// stamped transactions and then frozen onto the row.
async function closeShift(req, res) {
  const actualCash = parseMoney(req.body?.actual_cash);
  if (actualCash === undefined) {
    return res
      .status(400)
      .json({ message: 'actual_cash is required and must be a number >= 0', code: 'INVALID_ACTUAL_CASH' });
  }

  const shift = await cashierShiftRepository.findById(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  if (!(await canAccessShift(req, shift))) return res.status(403).json({ message: 'Forbidden' });

  if (shift.status !== CashierShift.STATUS.OPEN) {
    return res.status(409).json({ message: 'This shift is already closed', code: 'SHIFT_ALREADY_CLOSED' });
  }

  const [sales, refunds] = await Promise.all([
    cashierShiftRepository.sumCashSales(shift.id),
    cashierShiftRepository.sumCashRefunds(shift.id),
  ]);
  const expectedCash = cashierShiftService.calculateExpectedCash({
    openingCash: shift.opening_cash,
    cashSales: sales.total,
    cashRefunds: refunds.total,
  });
  const difference = cashierShiftService.calculateDifference({ actualCash, expectedCash });

  // Guarded on status OPEN — a second close racing this one updates nothing and gets the 409
  // below rather than overwriting an already-settled reconciliation.
  const closed = await cashierShiftRepository.close(shift.id, {
    cashSales: cashierShiftService.round(sales.total),
    cashRefunds: cashierShiftService.round(refunds.total),
    expectedCash,
    actualCash,
    difference,
    closedBy: req.account.accountId,
    note: req.body?.note || null,
  });
  if (!closed) {
    return res.status(409).json({ message: 'This shift is already closed', code: 'SHIFT_ALREADY_CLOSED' });
  }

  await recordAudit({
    req,
    action: ACTION.SHIFT_CLOSED,
    entityType: ENTITY_TYPE.CASHIER_SHIFT,
    entityId: closed.id,
    branchId: closed.branch_id,
    metadata: {
      employeeId: closed.employee_id,
      openingCash: closed.opening_cash,
      cashSales: closed.cash_sales,
      cashRefunds: closed.cash_refunds,
      expectedCash: closed.expected_cash,
      actualCash: closed.actual_cash,
      difference: closed.difference,
    },
  });

  res.json(closed);
}

// GET /api/cashier-shifts?branchId=&status=&employeeId=&page=&limit=
// "Employee chỉ xem Shift của chính mình / Branch Admin xem được Shift của Branch /
// SUPER_ADMIN xem toàn hệ thống" — all three fall straight out of the permission scope.
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.permissionScope === 'OWN') {
    const employee = await employeeRepository.findByAccountId(req.account.accountId);
    if (!employee) return res.json(buildPaginatedResult({ data: [], total: 0, page, limit }));
    filter.employee_id = employee.id;
  } else if (req.permissionScope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    filter.branch_id = { $in: branchIds };
    if (req.query.branchId && branchIds.includes(Number(req.query.branchId))) {
      filter.branch_id = Number(req.query.branchId);
    }
  } else if (req.query.branchId) {
    filter.branch_id = Number(req.query.branchId);
  }

  if (req.query.status) filter.status = req.query.status;
  // An OWN-scope caller is already pinned to themselves above, so this can only ever narrow
  // the list further for a branch-wide or system-wide viewer.
  if (req.query.employeeId && req.permissionScope !== 'OWN') filter.employee_id = Number(req.query.employeeId);

  const { data, total } = await cashierShiftRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/cashier-shifts/current -> the caller's own OPEN drawer plus its running totals, so
// the POS can show "expected cash so far" without waiting for the close.
async function current(req, res) {
  const employee = await employeeRepository.findByAccountId(req.account.accountId);
  if (!employee) return res.json({ shift: null, reconciliation: null });

  const shift = await cashierShiftRepository.findOpenByEmployee(employee.id);
  if (!shift) return res.json({ shift: null, reconciliation: null });

  res.json({ shift, reconciliation: await cashierShiftService.computeReconciliation(shift) });
}

// GET /api/cashier-shifts/:id
async function getById(req, res) {
  const shift = await cashierShiftRepository.findById(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  if (!(await canAccessShift(req, shift))) return res.status(403).json({ message: 'Forbidden' });
  res.json(shift);
}

// GET /api/cashier-shifts/:id/reconciliation -> the money view: live running totals while the
// shift is OPEN, the frozen settled figures once it is CLOSED.
async function reconciliation(req, res) {
  const shift = await cashierShiftRepository.findById(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  if (!(await canAccessShift(req, shift))) return res.status(403).json({ message: 'Forbidden' });

  res.json({ shift, reconciliation: await cashierShiftService.computeReconciliation(shift) });
}

module.exports = { canAccessShift, openShift, closeShift, list, current, getById, reconciliation };
