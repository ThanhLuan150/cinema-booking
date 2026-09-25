const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const incidentRepository = require('../repositories/incident.repository');
const incidentController = require('../controllers/incident.controller');

const router = express.Router();

// An ALL-scope caller may omit branchId to see every branch; a BRANCH-scope caller (owner or
// staffed employee) must supply one they have access to.
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

// GET /api/incidents?branchId=&category=&severity= (incident.read permission, branch-scoped)
router.get('/', requireAuth, requirePermission('incident.read'), resolveListAccess, asyncHandler(incidentController.list));

// GET /api/incidents/:id (incident.read permission, branch-scoped)
router.get(
  '/:id',
  requireAuth,
  requirePermission('incident.read'),
  requireBranchAccess((req) => incidentRepository.findBranchIdByIncidentId(req.params.id)),
  asyncHandler(incidentController.getById),
);

// POST /api/incidents { branch_id, category, severity?, title, description?, room_id? }
// (incident.create permission, branch-scoped)
router.post(
  '/',
  requireAuth,
  requirePermission('incident.create'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(incidentController.create),
);

module.exports = router;
