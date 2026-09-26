const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const employeeRepository = require('../repositories/employee.repository');
const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const shiftAssignmentController = require('../controllers/shiftAssignment.controller');

const router = express.Router();

// GET /api/shiftAssignment/me -> the caller's own work schedule (shiftAssignment.read
// permission — OWN scope for an Employee).
router.get(
  '/me',
  requireAuth,
  requirePermission('shiftAssignment.read'),
  asyncHandler(shiftAssignmentController.listMine),
);

// A Super Admin (ALL scope) may list without a branchId to see the whole system; everyone else
// must name a branch, which then goes through the usual ownership gate.
function requireBranchUnlessSuperAdmin(req, res, next) {
  if (req.permissionScope === 'ALL' && (req.query.branchId === undefined || req.query.branchId === '')) {
    req.branchId = null;
    return next();
  }
  return requireBranchOwnership((r) => Number(r.query.branchId))(req, res, next);
}

// GET /api/shiftAssignment?branchId=&employeeId=&date= -> management view (shiftAssignment.read
// permission, owner-scoped — only the branch's own admin, not a merely-staffed employee)
router.get(
  '/',
  requireAuth,
  requirePermission('shiftAssignment.read'),
  requireBranchUnlessSuperAdmin,
  asyncHandler(shiftAssignmentController.list),
);

// POST /api/shiftAssignment { employee_id, shift_id, date, start_at, end_at }
// (shiftAssignment.create permission, owner-scoped to the assigned employee's own branch)
router.post(
  '/',
  requireAuth,
  requirePermission('shiftAssignment.create'),
  requireBranchOwnership((req) => employeeRepository.findBranchIdByEmployeeId(req.body.employee_id)),
  asyncHandler(shiftAssignmentController.create),
);

// PUT /api/shiftAssignment/:id { shift_id, date, start_at, end_at, status }
// (shiftAssignment.update permission, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('shiftAssignment.update'),
  requireBranchOwnership((req) => shiftAssignmentRepository.findBranchIdByAssignmentId(req.params.id)),
  asyncHandler(shiftAssignmentController.update),
);

// DELETE /api/shiftAssignment/:id (shiftAssignment.delete permission, owner-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('shiftAssignment.delete'),
  requireBranchOwnership((req) => shiftAssignmentRepository.findBranchIdByAssignmentId(req.params.id)),
  asyncHandler(shiftAssignmentController.remove),
);

module.exports = router;
