const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireCinemaOwnership } = require('../middleware/ownership');
const cinemaController = require('../controllers/cinema.controller');

const router = express.Router();

// GET /api/cinema -> public list of approved cinemas (for the customer-facing "choose cinema" filter)
router.get('/', asyncHandler(cinemaController.list));

// GET /api/cinema/mine -> cinemas owned by the caller, any status (cinema.read permission)
router.get('/mine', requireAuth, requirePermission('cinema.read'), asyncHandler(cinemaController.mine));

// GET /api/cinema/pending -> cinemas awaiting approval (cinema.approve permission — super admin only)
router.get('/pending', requireAuth, requirePermission('cinema.approve'), asyncHandler(cinemaController.pending));

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

// POST /api/cinema/branch-admin { email, password, name, phone, cinema_name, address, city }
// (branchAdmin.create permission — super admin only) — provisions a Branch Admin account and
// their first cinema together, pre-approved.
router.post(
  '/branch-admin',
  requireAuth,
  requirePermission('branchAdmin.create'),
  asyncHandler(cinemaController.createBranchAdmin),
);

// POST /api/cinema (cinema.create permission)
router.post('/', requireAuth, requirePermission('cinema.create'), asyncHandler(cinemaController.create));

// PUT /api/cinema/:id (cinema.update permission, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('cinema.update'),
  requireCinemaOwnership((req) => Number(req.params.id)),
  asyncHandler(cinemaController.update),
);

// PUT /api/cinema/:id/approve (cinema.approve permission) — also unlocks the owner account's login gate
router.put('/:id/approve', requireAuth, requirePermission('cinema.approve'), asyncHandler(cinemaController.approve));

// PUT /api/cinema/:id/block (cinema.block permission)
router.put('/:id/block', requireAuth, requirePermission('cinema.block'), asyncHandler(cinemaController.block));

// DELETE /api/cinema/:id (cinema.delete permission)
router.delete('/:id', requireAuth, requirePermission('cinema.delete'), asyncHandler(cinemaController.remove));

module.exports = router;
