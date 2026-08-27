const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const auditLogController = require('../controllers/auditLog.controller');

const router = express.Router();

// Ticket 24 — audit-log viewer. Read-only by design: no POST/PUT/DELETE is mounted, and the
// AuditLog model itself refuses mutation.
//
// GET /api/audit-logs?branchId=... — an ALL-scope caller (Super Admin) may omit branchId to see
// the whole system, or pass one to filter. A BRANCH-scope caller (Branch Admin) that passes a
// branchId must be able to access it (requireBranchAccess); if they omit it, the controller
// narrows results to every branch they administer.
function resolveListAccess(req, res, next) {
  if (req.query.branchId !== undefined && req.query.branchId !== '') {
    return requireBranchAccess((r) => Number(r.query.branchId))(req, res, next);
  }
  next();
}

router.get(
  '/meta',
  requireAuth,
  requirePermission('auditLog.read'),
  asyncHandler(auditLogController.meta),
);

router.get(
  '/',
  requireAuth,
  requirePermission('auditLog.read'),
  resolveListAccess,
  asyncHandler(auditLogController.list),
);

router.get(
  '/:id',
  requireAuth,
  requirePermission('auditLog.read'),
  asyncHandler(auditLogController.getById),
);

module.exports = router;
