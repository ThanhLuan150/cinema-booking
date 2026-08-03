const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireCinemaOwnership } = require('../middleware/ownership');
const upload = require('../middleware/upload');
const cinemaController = require('../controllers/cinema.controller');

const router = express.Router();

const uploadOnboardMedia = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);

// GET /api/cinema -> public list of approved cinemas (for the customer-facing "choose cinema" filter)
router.get('/', asyncHandler(cinemaController.list));

// GET /api/cinema/mine -> cinemas owned by the caller, any status (auth: admin or theater staff)
router.get('/mine', requireAuth, requireRole(0, 2), asyncHandler(cinemaController.mine));

// GET /api/cinema/pending -> admin only, cinemas awaiting approval
router.get('/pending', requireAuth, requireRole(0), asyncHandler(cinemaController.pending));

// GET /api/cinema/top -> approved cinemas ranked by ticket booking volume, enriched with the
// average customer rating across the movies they've screened (public, for the homepage).
router.get('/top', asyncHandler(cinemaController.top));

// GET /api/cinema/favorites/mine -> cinemas the caller has favorited (auth required)
router.get('/favorites/mine', requireAuth, asyncHandler(cinemaController.favoritesMine));

// GET /api/cinema/:id/favorite -> favorite count for that cinema (public)
router.get('/:id/favorite', asyncHandler(cinemaController.favoriteCount));

// POST /api/cinema/favorite { cinema_id } (auth required)
router.post('/favorite', requireAuth, asyncHandler(cinemaController.favorite));

// POST /api/cinema/unfavorite { cinema_id } (auth required)
router.post('/unfavorite', requireAuth, asyncHandler(cinemaController.unfavorite));

// GET /api/cinema/:id -> public detail
router.get('/:id', asyncHandler(cinemaController.getById));

// POST /api/cinema/onboard (multipart: email, name, phone, address, city, avatar file, images files)
// — lets a newly-verified theater owner submit their cinema info before their first login.
router.post('/onboard', uploadOnboardMedia, asyncHandler(cinemaController.onboard));

// POST /api/cinema (admin or theater staff)
router.post('/', requireAuth, requireRole(0, 2), asyncHandler(cinemaController.create));

// PUT /api/cinema/:id (owner or admin)
router.put(
  '/:id',
  requireAuth,
  requireRole(0, 2),
  requireCinemaOwnership((req) => Number(req.params.id)),
  asyncHandler(cinemaController.update),
);

// PUT /api/cinema/:id/approve (admin only) — also unlocks the owner account's login gate
router.put('/:id/approve', requireAuth, requireRole(0), asyncHandler(cinemaController.approve));

// PUT /api/cinema/:id/block (admin only)
router.put('/:id/block', requireAuth, requireRole(0), asyncHandler(cinemaController.block));

// DELETE /api/cinema/:id (admin only)
router.delete('/:id', requireAuth, requireRole(0), asyncHandler(cinemaController.remove));

module.exports = router;
