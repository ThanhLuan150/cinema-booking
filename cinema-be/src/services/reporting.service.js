const reportingRepository = require('../repositories/reporting.repository');
const bookingRepository = require('../repositories/booking.repository');
const permissionService = require('./permission.service');
const Branch = require('../models/Branch');

const OPERATIONAL_METRICS = {
  showtimesToday: 'schedule.read',
  ticketsIssuedToday: 'ticket.read',
  ticketsCheckedInToday: 'ticket.checkin',
  pendingComboOrders: 'combo.order.view',
  openMaintenance: 'maintenance.read',
};

class ReportAccessError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ReportAccessError';
  }
}

function parseBranchIdParam(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ReportAccessError('Invalid branchId');
  return n;
}

async function resolveReportScope(req, { branchIdParam } = {}) {
  const requested = parseBranchIdParam(branchIdParam);

  if (req.permissionScope === 'ALL') {
    if (requested == null) return { branchIds: null };
    const branch = await Branch.findOne({ id: requested }, { id: 1 });
    if (!branch) throw new ReportAccessError('Branch not found');
    return { branchIds: [requested] };
  }

  if (req.permissionScope === 'BRANCH') {
    const accessible = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    if (accessible.length === 0) throw new ReportAccessError('No accessible branch');
    if (requested != null && !accessible.includes(requested)) {
      throw new ReportAccessError('Forbidden');
    }
    return { branchIds: requested != null ? [requested] : accessible };
  }

  throw new ReportAccessError('Forbidden');
}

async function getFinancialReport({ branchIds, from, to } = {}) {
  const [revenue, totals, revenueByBranch, topMovies, refundSummary, revenueByDay] = await Promise.all([
    reportingRepository.getRevenueBreakdown({ branchIds, from, to }),
    reportingRepository.getTotals({ branchIds }),
    reportingRepository.getRevenueByBranch({ branchIds, from, to }),
    reportingRepository.getTopMovies({ branchIds, from, to }),
    reportingRepository.getRefundSummary({ branchIds, from, to }),
    reportingRepository.getRevenueByDay({ branchIds, from, to }),
  ]);

  return {
    scope: branchIds == null ? 'ALL' : 'BRANCH',
    branchIds: branchIds == null ? null : branchIds,
    range: { from: from || null, to: to || null },
    totals,
    revenue,
    revenueByBranch,
    topMovies,
    refundSummary,
    revenueByDay,
  };
}

function selectOperationalMetrics(permissionCodes) {
  const held = permissionCodes instanceof Set ? permissionCodes : new Set(permissionCodes ?? []);
  return Object.keys(OPERATIONAL_METRICS).filter((key) => held.has(OPERATIONAL_METRICS[key]));
}

async function getOperationalReport({ branchIds, account } = {}) {
  const resolved = await permissionService.resolvePermissionCodes(account);
  const keys = selectOperationalMetrics(resolved?.codes);

  return {
    scope: branchIds == null ? 'ALL' : 'BRANCH',
    branchIds: branchIds == null ? null : branchIds,
    positionCode: resolved?.positionCode ?? null,
    metrics: await reportingRepository.getOperationalSummary({ branchIds, keys }),
  };
}

module.exports = {
  OPERATIONAL_METRICS,
  ReportAccessError,
  resolveReportScope,
  selectOperationalMetrics,
  getFinancialReport,
  getOperationalReport,
};
