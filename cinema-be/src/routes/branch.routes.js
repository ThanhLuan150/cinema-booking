const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const branchController = require('../controllers/branch.controller');

const router = express.Router();

// GET /api/cinema -> public list of active branches (for the customer-facing "choose branch" filter)
router.get('/', asyncHandler(branchController.list));

// GET /api/cinema/mine -> Super Admin sees every branch; Branch Admin sees only their own (branch.read permission)
router.get('/mine', requireAuth, requirePermission('branch.read'), asyncHandler(branchController.mine));

// GET /api/cinema/top -> active branches ranked by ticket booking volume, enriched with the
// average customer rating across the movies they've screened (public, for the homepage).
router.get('/top', asyncHandler(branchController.top));

// GET /api/cinema/favorites/mine -> branches the caller has favorited (auth required)
router.get('/favorites/mine', requireAuth, asyncHandler(branchController.favoritesMine));

// GET /api/cinema/:id/favorite -> favorite count for that branch (public)
router.get('/:id/favorite', asyncHandler(branchController.favoriteCount));

// POST /api/cinema/favorite { cinema_id } (auth required)
router.post('/favorite', requireAuth, asyncHandler(branchController.favorite));

// POST /api/cinema/unfavorite { cinema_id } (auth required)
router.post('/unfavorite', requireAuth, asyncHandler(branchController.unfavorite));

// GET /api/cinema/:id/detail -> full branch info regardless of status (branch.read permission,
router.get(
  '/:id/detail',
  requireAuth,
  requirePermission('branch.read'),
  requireBranchAccess((req) => Number(req.params.id)),
  asyncHandler(branchController.getAdminDetail),
);

// GET /api/cinema/:id -> public detail (active branches only)
router.get('/:id', asyncHandler(branchController.getById));

// POST /api/cinema/branch-admin { email, password, name, phone, cinema_name, code, company_id? }
router.post(
  '/branch-admin',
  requireAuth,
  requirePermission('branchAdmin.create'),
  asyncHandler(branchController.createBranchAdmin),
);

// POST /api/cinema (branch.create permission — super admin only)
router.post('/', requireAuth, requirePermission('branch.create'), asyncHandler(branchController.create));

// PUT /api/cinema/:id (branch.update permission, branch-scoped — Super Admin any branch,
// Branch Admin only their own, and only their own contact/operating fields)
router.put(
  '/:id',
  requireAuth,
  requirePermission('branch.update'),
  requireBranchOwnership((req) => Number(req.params.id)),
  asyncHandler(branchController.update),
);

// PUT /api/cinema/:id/activate (branch.activate permission — super admin only)
router.put(
  '/:id/activate',
  requireAuth,
  requirePermission('branch.activate'),
  asyncHandler(branchController.activate),
);

// PUT /api/cinema/:id/disable (branch.disable permission — super admin only)
router.put('/:id/disable', requireAuth, requirePermission('branch.disable'), asyncHandler(branchController.disable));

// PUT /api/cinema/:id/maintenance (branch.disable permission — super admin only)
router.put(
  '/:id/maintenance',
  requireAuth,
  requirePermission('branch.disable'),
  asyncHandler(branchController.maintenance),
);

// PUT /api/cinema/:id/assign-admin { account_id } (branch.assignAdmin permission — super admin only)
router.put(
  '/:id/assign-admin',
  requireAuth,
  requirePermission('branch.assignAdmin'),
  asyncHandler(branchController.assignAdmin),
);

// DELETE /api/cinema/:id (branch.delete permission — super admin only; refuses when the branch
// still has active employees or rooms attached)
router.delete('/:id', requireAuth, requirePermission('branch.delete'), asyncHandler(branchController.remove));

module.exports = router;
