const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const { requireKiosk } = require('../middleware/kioskAuth');
const kioskRepository = require('../repositories/kiosk.repository');
const kioskController = require('../controllers/kiosk.controller');

const router = express.Router();

// GET /api/kiosks?branchId=... — ALL-scope callers may omit branchId; BRANCH-scope callers
// must pass one they can access. (Mirrors device.routes' resolveListAccess.)
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

// ---------------------------------------------------------------------------
// Self-service flow — authenticated by the X-Kiosk-Key header (no user JWT). Declared before
// the admin "/:id" route so "session", "movies", "showtimes", etc. aren't parsed as an id.
// ---------------------------------------------------------------------------
router.get('/session', requireKiosk, asyncHandler(kioskController.session));
router.get('/movies', requireKiosk, asyncHandler(kioskController.listMovies));
router.get('/combos', requireKiosk, asyncHandler(kioskController.listCombos));
router.get('/movies/:movieId/showtimes', requireKiosk, asyncHandler(kioskController.listShowtimes));
router.get('/showtimes/:scheduleId/seats', requireKiosk, asyncHandler(kioskController.listSeats));
router.post('/showtimes/:scheduleId/hold', requireKiosk, asyncHandler(kioskController.holdSeats));
router.post('/showtimes/:scheduleId/release', requireKiosk, asyncHandler(kioskController.releaseSeats));
router.post('/quote', requireKiosk, asyncHandler(kioskController.quote));
router.post('/checkout', requireKiosk, asyncHandler(kioskController.checkout));
router.post('/checkout/:code/confirm', requireKiosk, asyncHandler(kioskController.confirmPayment));
router.get('/bookings/:code/tickets', requireKiosk, asyncHandler(kioskController.bookingTickets));

// ---------------------------------------------------------------------------
// Admin CRUD — JWT + kiosk.* permission + branch scope.
// ---------------------------------------------------------------------------
router.get('/', requireAuth, requirePermission('kiosk.read'), resolveListAccess, asyncHandler(kioskController.list));

router.get(
  '/:id',
  requireAuth,
  requirePermission('kiosk.read'),
  requireBranchAccess((req) => kioskRepository.findBranchIdByKioskId(req.params.id)),
  asyncHandler(kioskController.getById),
);

router.post(
  '/',
  requireAuth,
  requirePermission('kiosk.create'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(kioskController.create),
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('kiosk.update'),
  requireBranchAccess((req) => kioskRepository.findBranchIdByKioskId(req.params.id)),
  asyncHandler(kioskController.update),
);

router.post(
  '/:id/rotate-key',
  requireAuth,
  requirePermission('kiosk.update'),
  requireBranchAccess((req) => kioskRepository.findBranchIdByKioskId(req.params.id)),
  asyncHandler(kioskController.rotateKey),
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('kiosk.delete'),
  requireBranchAccess((req) => kioskRepository.findBranchIdByKioskId(req.params.id)),
  asyncHandler(kioskController.remove),
);

module.exports = router;
