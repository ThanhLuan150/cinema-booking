const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const integrationController = require('../controllers/integration.controller');

const router = express.Router();

// Integration registration is SUPER_ADMIN-only (integration.read / integration.manage are
// not granted to any other role) — third-party service credentials/config are platform-wide.
router.get('/all', requireAuth, requirePermission('integration.read'), asyncHandler(integrationController.all));
router.get('/', requireAuth, requirePermission('integration.read'), asyncHandler(integrationController.list));
router.get('/:id', requireAuth, requirePermission('integration.read'), asyncHandler(integrationController.getById));

router.post('/', requireAuth, requirePermission('integration.manage'), asyncHandler(integrationController.create));
router.put('/:id', requireAuth, requirePermission('integration.manage'), asyncHandler(integrationController.update));
router.delete('/:id', requireAuth, requirePermission('integration.manage'), asyncHandler(integrationController.remove));

module.exports = router;
