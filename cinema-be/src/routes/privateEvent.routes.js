const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const privateEventRepository = require('../repositories/privateEvent.repository');
const privateEventController = require('../controllers/privateEvent.controller');

const router = express.Router();

// Admin list access, mirroring parking.routes: an ALL-scope caller may omit branchId to see
// every branch; a BRANCH-scope caller must supply a branchId they can access. A customer
// (OWN scope) has no business on this endpoint — they use /private-events/mine.
function resolveListAccess(req, res, next) {
  if (req.permissionScope === 'OWN') {
    return res.status(403).json({ message: 'Use /private-events/mine' });
  }
  if (req.query.branchId !== undefined && req.query.branchId !== '') {
    return requireBranchAccess((r) => Number(r.query.branchId))(req, res, next);
  }
  if (req.permissionScope !== 'ALL') {
    return res.status(400).json({ message: 'branchId is required' });
  }
  req.branchId = null;
  return next();
}

// Loads the event into req.privateEvent for the admin action handlers (runs after
// requireBranchAccess has already confirmed the caller owns its branch).
const loadEvent = asyncHandler(async (req, res, next) => {
  const event = await privateEventRepository.findEventById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Private event not found' });
  req.privateEvent = event;
  return next();
});

const branchOfEvent = (req) => privateEventRepository.findBranchIdByEventId(req.params.id);

// ---- Event packages (SUPER_ADMIN maintains, everyone reads) ------------

router.get(
  '/packages',
  requireAuth,
  requirePermission('eventPackage.read'),
  asyncHandler(privateEventController.listPackages),
);
router.get(
  '/packages/:id',
  requireAuth,
  requirePermission('eventPackage.read'),
  asyncHandler(privateEventController.getPackage),
);
router.post(
  '/packages',
  requireAuth,
  requirePermission('eventPackage.manage'),
  asyncHandler(privateEventController.createPackage),
);
router.put(
  '/packages/:id',
  requireAuth,
  requirePermission('eventPackage.manage'),
  asyncHandler(privateEventController.updatePackage),
);
router.delete(
  '/packages/:id',
  requireAuth,
  requirePermission('eventPackage.manage'),
  asyncHandler(privateEventController.removePackage),
);

// ---- Customer flow ---------------------------------------------------

router.post(
  '/',
  requireAuth,
  requirePermission('privateEvent.request'),
  asyncHandler(privateEventController.requestEvent),
);
router.get(
  '/mine',
  requireAuth,
  requirePermission('privateEvent.request'),
  asyncHandler(privateEventController.listMine),
);
router.post(
  '/:id/pay',
  requireAuth,
  requirePermission('privateEvent.request'),
  asyncHandler(privateEventController.payEvent),
);
router.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('privateEvent.request'),
  asyncHandler(privateEventController.cancelOwnEvent),
);

// ---- Admin review flow --------------------------------------------

router.get(
  '/',
  requireAuth,
  requirePermission('privateEvent.read'),
  resolveListAccess,
  asyncHandler(privateEventController.listEvents),
);
router.get(
  '/:id',
  requireAuth,
  requirePermission('privateEvent.read'),
  asyncHandler(privateEventController.getEvent),
);

for (const [path, handler] of [
  ['/:id/quote', privateEventController.quoteEvent],
  ['/:id/approve', privateEventController.approveEvent],
  ['/:id/confirm', privateEventController.confirmEvent],
  ['/:id/complete', privateEventController.completeEvent],
  ['/:id/reject', privateEventController.rejectEvent],
]) {
  router.post(
    path,
    requireAuth,
    requirePermission('privateEvent.review'),
    requireBranchAccess(branchOfEvent),
    loadEvent,
    asyncHandler(handler),
  );
}

module.exports = router;
