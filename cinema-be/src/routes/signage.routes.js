const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const { requireScreen } = require('../middleware/screenAuth');
const signageRepository = require('../repositories/signage.repository');
const signageController = require('../controllers/signage.controller');

const router = express.Router();

// GET /api/signage/playback — the media player's own poll, authenticated by the X-Screen-Key
// header (no user JWT). Declared first so it never collides with the /screens/* routes.
router.get('/playback', requireScreen, asyncHandler(signageController.getSelfPlayback));

// GET list endpoints: an ALL-scope caller may omit branchId to see every branch; a BRANCH-scope
// caller must supply a branchId they can access.
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

// A playlist entry has no branch_id of its own — it is branch-scoped through its screen.
async function branchIdOfEntryScreen(req) {
  const entry = await signageRepository.findScheduleById(req.params.id);
  if (!entry) return null;
  return signageRepository.findBranchIdByScreenId(entry.screen_id);
}

// GET /api/signage/schedules — BRANCH-scope callers must scope by a screenId they can access.
function resolveScheduleListAccess(req, res, next) {
  if (req.query.screenId !== undefined && req.query.screenId !== '') {
    return requireBranchAccess((r) => signageRepository.findBranchIdByScreenId(r.query.screenId))(req, res, next);
  }
  if (req.permissionScope !== 'ALL') {
    return res.status(400).json({ message: 'screenId is required' });
  }
  next();
}

// ---- Screens ---------------------------------------------------------------

router.get('/screens', requireAuth, requirePermission('signage.read'), resolveListAccess, asyncHandler(signageController.listScreens));

router.get(
  '/screens/:id',
  requireAuth,
  requirePermission('signage.read'),
  requireBranchAccess((req) => signageRepository.findBranchIdByScreenId(req.params.id)),
  asyncHandler(signageController.getScreen),
);

router.get(
  '/screens/:id/playback',
  requireAuth,
  requirePermission('signage.read'),
  requireBranchAccess((req) => signageRepository.findBranchIdByScreenId(req.params.id)),
  asyncHandler(signageController.getScreenPlayback),
);

router.post(
  '/screens',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(signageController.createScreen),
);

router.put(
  '/screens/:id',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => signageRepository.findBranchIdByScreenId(req.params.id)),
  asyncHandler(signageController.updateScreen),
);

router.post(
  '/screens/:id/rotate-key',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => signageRepository.findBranchIdByScreenId(req.params.id)),
  asyncHandler(signageController.rotateScreenKey),
);

router.delete(
  '/screens/:id',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => signageRepository.findBranchIdByScreenId(req.params.id)),
  asyncHandler(signageController.removeScreen),
);

// ---- Content -------------------------------------------------------------

router.get('/contents', requireAuth, requirePermission('signage.read'), resolveListAccess, asyncHandler(signageController.listContent));

router.get(
  '/contents/:id',
  requireAuth,
  requirePermission('signage.read'),
  requireBranchAccess((req) => signageRepository.findBranchIdByContentId(req.params.id)),
  asyncHandler(signageController.getContent),
);

router.post(
  '/contents',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(signageController.createContent),
);

router.put(
  '/contents/:id',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => signageRepository.findBranchIdByContentId(req.params.id)),
  asyncHandler(signageController.updateContent),
);

router.delete(
  '/contents/:id',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => signageRepository.findBranchIdByContentId(req.params.id)),
  asyncHandler(signageController.removeContent),
);

// ---- Schedules (playlist entries) --------------------------------------------

router.get('/schedules', requireAuth, requirePermission('signage.read'), resolveScheduleListAccess, asyncHandler(signageController.listSchedules));

router.get(
  '/schedules/:id',
  requireAuth,
  requirePermission('signage.read'),
  requireBranchAccess(branchIdOfEntryScreen),
  asyncHandler(signageController.getSchedule),
);

router.post(
  '/schedules',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess((req) => signageRepository.findBranchIdByScreenId(req.body.screen_id)),
  asyncHandler(signageController.createSchedule),
);

router.put(
  '/schedules/:id',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess(branchIdOfEntryScreen),
  asyncHandler(signageController.updateSchedule),
);

router.delete(
  '/schedules/:id',
  requireAuth,
  requirePermission('signage.manage'),
  requireBranchAccess(branchIdOfEntryScreen),
  asyncHandler(signageController.removeSchedule),
);

module.exports = router;
