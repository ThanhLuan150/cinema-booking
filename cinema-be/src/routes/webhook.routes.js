const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

// Admin monitoring log (SUPER_ADMIN-only, same module as /integrations).
router.get('/', requireAuth, requirePermission('integration.read'), asyncHandler(webhookController.list));
router.post('/:id/retry', requireAuth, requirePermission('integration.manage'), asyncHandler(webhookController.retry));
router.get('/:id', requireAuth, requirePermission('integration.read'), asyncHandler(webhookController.getById));

// Public inbound webhook receiver — a third party can't hold our JWT, so this is
// authenticated purely via the provider's own signature scheme (see webhook.controller.receive).
// Mounted last so it never shadows the admin routes above.
router.post('/:provider', asyncHandler(webhookController.receive));

module.exports = router;
