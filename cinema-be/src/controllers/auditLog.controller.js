const auditLogRepository = require('../repositories/auditLog.repository');
const bookingRepository = require('../repositories/booking.repository');
const AuditLog = require('../models/AuditLog');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// Ticket 24 — read-only audit-log viewer. There is deliberately no create/update/delete
// endpoint: rows are appended by the server itself (auditLog.service) and the model forbids
// mutation. Access is gated by `auditLog.read`; branch scoping is enforced here:
//   - ALL scope (Super Admin): sees the whole system, may optionally filter by ?branchId.
//   - BRANCH scope (Branch Admin, when granted): restricted to branches they administer /
//     are staffed at — the route sets req.branchId, and OWN/other scopes get nothing.

async function resolveScopeFilter(req) {
  if (req.permissionScope === 'ALL') {
    return { branchId: req.query.branchId };
  }
  // BRANCH scope: the route's requireBranchAccess already validated req.branchId when a branchId
  // was supplied. With none supplied, fall back to every branch this account can reach.
  if (req.branchId !== null && req.branchId !== undefined) {
    return { branchIds: [Number(req.branchId)] };
  }
  const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
  return { branchIds: branchIds.length > 0 ? branchIds : [-1] };
}

// GET /api/audit-logs?entityType=&entityId=&action=&performedBy=&branchId=&from=&to=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = await resolveScopeFilter(req);

  const { data, total } = await auditLogRepository.findFiltered(
    {
      ...scope,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      action: req.query.action,
      performedBy: req.query.performedBy,
      from: req.query.from,
      to: req.query.to,
    },
    { skip, limit },
  );

  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/audit-logs/meta — the enum vocabulary, for the viewer's filter dropdowns.
async function meta(_req, res) {
  res.json({
    actions: Object.values(AuditLog.ACTION),
    entityTypes: Object.values(AuditLog.ENTITY_TYPE),
  });
}

// GET /api/audit-logs/:id — a single row, still branch-scoped for a BRANCH caller.
async function getById(req, res) {
  const log = await auditLogRepository.findById(req.params.id);
  if (!log) return res.status(404).json({ message: 'Audit log not found' });

  if (req.permissionScope !== 'ALL') {
    const scope = await resolveScopeFilter(req);
    const allowed = Array.isArray(scope.branchIds) ? scope.branchIds : [];
    if (log.branch_id === null || !allowed.includes(log.branch_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  res.json(log);
}

module.exports = { list, meta, getById };
