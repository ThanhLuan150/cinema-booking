const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const systemConfigController = require('../controllers/systemConfig.controller');

const router = express.Router();

// Static route must precede /:key so "meta" isn't parsed as a setting key.
router.get('/meta', requireAuth, requirePermission('systemConfig.read'), asyncHandler(systemConfigController.meta));

router.get('/', requireAuth, requirePermission('systemConfig.read'), asyncHandler(systemConfigController.list));

router.get('/:key', requireAuth, requirePermission('systemConfig.read'), asyncHandler(systemConfigController.getByKey));

router.put('/:key', requireAuth, requirePermission('systemConfig.manage'), asyncHandler(systemConfigController.update));

router.delete('/:key', requireAuth, requirePermission('systemConfig.manage'), asyncHandler(systemConfigController.reset));

module.exports = router;
