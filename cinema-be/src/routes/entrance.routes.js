const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const entranceRepository = require('../repositories/entrance.repository');
const entranceController = require('../controllers/entrance.controller');

const router = express.Router();

// GET /api/entrance?branchId=&status= — an ALL-scope caller may omit branchId to see every
// branch; a BRANCH-scope caller (owner or staffed employee) must supply one they can access.
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

router.get('/', requireAuth, requirePermission('entrance.read'), resolveListAccess, asyncHandler(entranceController.list));

router.get(
  '/:id',
  requireAuth,
  requirePermission('entrance.read'),
  requireBranchAccess((req) => entranceRepository.findBranchIdByEntranceId(req.params.id)),
  asyncHandler(entranceController.getById),
);

router.post(
  '/',
  requireAuth,
  requirePermission('entrance.create'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(entranceController.create),
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('entrance.update'),
  requireBranchAccess((req) => entranceRepository.findBranchIdByEntranceId(req.params.id)),
  asyncHandler(entranceController.update),
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('entrance.delete'),
  requireBranchAccess((req) => entranceRepository.findBranchIdByEntranceId(req.params.id)),
  asyncHandler(entranceController.remove),
);

module.exports = router;
