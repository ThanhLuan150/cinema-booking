const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const maintenanceRequestRepository = require('../repositories/maintenanceRequest.repository');
const maintenanceRequestController = require('../controllers/maintenanceRequest.controller');

const router = express.Router();

// GET /api/maintenance?branchId=&status=&resourceType=&roomId= — an ALL-scope caller may omit
// branchId to see every branch; a BRANCH-scope caller (owner or staffed employee) must supply
// one they have access to.
function resolveListAccess(req, res, next) {
  if (req.query.branchId !== undefined && req.query.branchId !== '') {
    return requireBranchAccess((r) => Number(r.query.branchId))(req, res, next);
  }
  if (req.permissionScope !== 'ALL') {
    return res.status(400).json({ message: 'branchId is required' });
  }
  req.branchId = null;
  next();
}

// GET /api/maintenance?branchId=&status=&resourceType=&roomId= (maintenance.read permission, branch-scoped)
router.get('/', requireAuth, requirePermission('maintenance.read'), resolveListAccess, asyncHandler(maintenanceRequestController.list));

// GET /api/maintenance/:id (maintenance.read permission, branch-scoped)
router.get(
  '/:id',
  requireAuth,
  requirePermission('maintenance.read'),
  requireBranchAccess((req) => maintenanceRequestRepository.findBranchIdByRequestId(req.params.id)),
  asyncHandler(maintenanceRequestController.getById),
);

// POST /api/maintenance { branch_id, resource_type, room_id?, seat_id?, resource_name?, title,
// description? } (maintenance.create permission, branch-scoped — any staffed Employee may report
// an issue, not just Branch Admin)
router.post(
  '/',
  requireAuth,
  requirePermission('maintenance.create'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(maintenanceRequestController.create),
);

// PUT /api/maintenance/:id { title, description, resource_name } (maintenance.update permission, branch-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('maintenance.update'),
  requireBranchAccess((req) => maintenanceRequestRepository.findBranchIdByRequestId(req.params.id)),
  asyncHandler(maintenanceRequestController.update),
);

// POST /api/maintenance/:id/assign { employee_id } (maintenance.assign permission, branch-scoped)
router.post(
  '/:id/assign',
  requireAuth,
  requirePermission('maintenance.assign'),
  requireBranchAccess((req) => maintenanceRequestRepository.findBranchIdByRequestId(req.params.id)),
  asyncHandler(maintenanceRequestController.assign),
);

// POST /api/maintenance/:id/start -> ASSIGNED -> IN_PROGRESS (maintenance.update permission, branch-scoped)
router.post(
  '/:id/start',
  requireAuth,
  requirePermission('maintenance.update'),
  requireBranchAccess((req) => maintenanceRequestRepository.findBranchIdByRequestId(req.params.id)),
  asyncHandler(maintenanceRequestController.start),
);

// POST /api/maintenance/:id/resolve { resolution_note } -> IN_PROGRESS -> RESOLVED (maintenance.update permission, branch-scoped)
router.post(
  '/:id/resolve',
  requireAuth,
  requirePermission('maintenance.update'),
  requireBranchAccess((req) => maintenanceRequestRepository.findBranchIdByRequestId(req.params.id)),
  asyncHandler(maintenanceRequestController.resolve),
);

// POST /api/maintenance/:id/close -> RESOLVED -> CLOSED (maintenance.close permission, branch-scoped)
router.post(
  '/:id/close',
  requireAuth,
  requirePermission('maintenance.close'),
  requireBranchAccess((req) => maintenanceRequestRepository.findBranchIdByRequestId(req.params.id)),
  asyncHandler(maintenanceRequestController.close),
);

// DELETE /api/maintenance/:id (maintenance.delete permission, branch-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('maintenance.delete'),
  requireBranchAccess((req) => maintenanceRequestRepository.findBranchIdByRequestId(req.params.id)),
  asyncHandler(maintenanceRequestController.remove),
);

module.exports = router;
