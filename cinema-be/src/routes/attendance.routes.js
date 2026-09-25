const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const employeeRepository = require('../repositories/employee.repository');
const attendanceRepository = require('../repositories/attendance.repository');
const attendanceController = require('../controllers/attendance.controller');

const router = express.Router();

// ---- Employee self-service (attendance.clock) ---------------------------------
// None of these take an employee id: the actor is always the token's own employee record.

router.get('/today', requireAuth, requirePermission('attendance.clock'), asyncHandler(attendanceController.today));
router.post('/clock-in', requireAuth, requirePermission('attendance.clock'), asyncHandler(attendanceController.clockIn));
router.post(
  '/break/start',
  requireAuth,
  requirePermission('attendance.clock'),
  asyncHandler(attendanceController.startBreak),
);
router.post('/break/end', requireAuth, requirePermission('attendance.clock'), asyncHandler(attendanceController.endBreak));
router.post('/clock-out', requireAuth, requirePermission('attendance.clock'), asyncHandler(attendanceController.clockOut));

// ---- Reading (attendance.read; scope decides who sees what) ----------------------

// Own history — the same rows an Employee gets from the list below, at a stable URL.
router.get('/me', requireAuth, requirePermission('attendance.read'), asyncHandler(attendanceController.listMine));

// OWN scope (Employee) needs no branch gate: the controller pins the query to the caller. BRANCH
// scope (Branch Admin) must name a branch they own. ALL scope (Super Admin) may omit branchId.
function resolveListAccess(req, res, next) {
  if (req.permissionScope === 'OWN') return next();
  if (req.query.branchId !== undefined && req.query.branchId !== '') {
    return requireBranchOwnership((r) => Number(r.query.branchId))(req, res, next);
  }
  if (req.permissionScope !== 'ALL') {
    return res.status(400).json({ message: 'branchId is required' });
  }
  req.branchId = null;
  next();
}

router.get(
  '/',
  requireAuth,
  requirePermission('attendance.read'),
  resolveListAccess,
  asyncHandler(attendanceController.list),
);

async function branchIdOfRecord(req) {
  const record = await attendanceRepository.findById(req.params.id);
  return record ? record.branch_id : null;
}

// A single row: Employee (OWN) is checked against ownership in the controller; everyone else
// goes through the branch gate.
function resolveRecordAccess(req, res, next) {
  if (req.permissionScope === 'OWN') return next();
  return requireBranchOwnership(branchIdOfRecord)(req, res, next);
}

router.get(
  '/:id(\\d+)',
  requireAuth,
  requirePermission('attendance.read'),
  resolveRecordAccess,
  asyncHandler(attendanceController.getOne),
);

// ---- Management (attendance.manage, branch-owner scoped) --------------------------

router.post(
  '/mark',
  requireAuth,
  requirePermission('attendance.manage'),
  requireBranchOwnership((req) => employeeRepository.findBranchIdByEmployeeId(req.body.employee_id)),
  asyncHandler(attendanceController.mark),
);

router.patch(
  '/:id(\\d+)/close',
  requireAuth,
  requirePermission('attendance.manage'),
  requireBranchOwnership(branchIdOfRecord),
  asyncHandler(attendanceController.closeSession),
);

module.exports = router;
