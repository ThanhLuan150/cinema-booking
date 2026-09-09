const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const movieReleaseController = require('../controllers/movieRelease.controller');

const router = express.Router();

// Read: SUPER_ADMIN + BRANCH_ADMIN (movieRelease.read, ALL scope — Movie/Release is a
// company-wide catalog, not per-branch). Write: SUPER_ADMIN only (movieRelease.manage).
router.get('/', requireAuth, requirePermission('movieRelease.read'), asyncHandler(movieReleaseController.list));
router.get('/:id', requireAuth, requirePermission('movieRelease.read'), asyncHandler(movieReleaseController.getById));

router.post('/', requireAuth, requirePermission('movieRelease.manage'), asyncHandler(movieReleaseController.create));
router.put('/:id', requireAuth, requirePermission('movieRelease.manage'), asyncHandler(movieReleaseController.update));
router.delete('/:id', requireAuth, requirePermission('movieRelease.manage'), asyncHandler(movieReleaseController.remove));

module.exports = router;
