const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const distributorController = require('../controllers/distributor.controller');

const router = express.Router();

// Distributor management is SUPER_ADMIN-only (distributor.read / distributor.manage are not
// granted to any other role). A Branch Admin sees distributor names only via the embedded
// summary on the movie-release list.
router.get('/all', requireAuth, requirePermission('distributor.read'), asyncHandler(distributorController.all));
router.get('/', requireAuth, requirePermission('distributor.read'), asyncHandler(distributorController.list));
router.get('/:id', requireAuth, requirePermission('distributor.read'), asyncHandler(distributorController.getById));

router.post('/', requireAuth, requirePermission('distributor.manage'), asyncHandler(distributorController.create));
router.put('/:id', requireAuth, requirePermission('distributor.manage'), asyncHandler(distributorController.update));
router.delete('/:id', requireAuth, requirePermission('distributor.manage'), asyncHandler(distributorController.remove));

module.exports = router;
