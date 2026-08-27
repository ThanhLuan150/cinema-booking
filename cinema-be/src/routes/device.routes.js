const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const { requireDevice } = require('../middleware/deviceAuth');
const deviceRepository = require('../repositories/device.repository');
const deviceController = require('../controllers/device.controller');

const router = express.Router();

// GET /api/devices?branchId=... — ALL-scope callers may omit branchId; BRANCH-scope callers
// must pass one they can access. Shared by the device list and the check-in log list.
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

// POST /api/devices/checkin { qr_token } — device-authenticated (X-Device-Key header), no user
// JWT. Enforces the branch-isolation security rule and writes a CheckinLog for every attempt.
router.post('/checkin', requireDevice, asyncHandler(deviceController.checkin));

// GET /api/devices/logs — must precede /:id so "logs" isn't parsed as a device id.
router.get('/logs', requireAuth, requirePermission('device.read'), resolveListAccess, asyncHandler(deviceController.listLogs));

router.get('/', requireAuth, requirePermission('device.read'), resolveListAccess, asyncHandler(deviceController.list));

router.get(
  '/:id',
  requireAuth,
  requirePermission('device.read'),
  requireBranchAccess((req) => deviceRepository.findBranchIdByDeviceId(req.params.id)),
  asyncHandler(deviceController.getById),
);

router.post(
  '/',
  requireAuth,
  requirePermission('device.create'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(deviceController.create),
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('device.update'),
  requireBranchAccess((req) => deviceRepository.findBranchIdByDeviceId(req.params.id)),
  asyncHandler(deviceController.update),
);

router.post(
  '/:id/rotate-key',
  requireAuth,
  requirePermission('device.update'),
  requireBranchAccess((req) => deviceRepository.findBranchIdByDeviceId(req.params.id)),
  asyncHandler(deviceController.rotateKey),
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('device.delete'),
  requireBranchAccess((req) => deviceRepository.findBranchIdByDeviceId(req.params.id)),
  asyncHandler(deviceController.remove),
);

module.exports = router;
