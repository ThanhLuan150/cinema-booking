const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const notificationTemplateController = require('../controllers/notificationTemplate.controller');

const router = express.Router();

// Ticket 26 — notification template management. Templates are global, system-wide content, so
// there is no branch scoping: access is gated purely by the notificationTemplate.* permissions
// (Super Admin by default via seedRbac).

// Static / collection routes must precede the /:id routes so "meta" / "preview" aren't parsed
// as an id.
router.get(
  '/meta',
  requireAuth,
  requirePermission('notificationTemplate.read'),
  asyncHandler(notificationTemplateController.meta),
);

router.post(
  '/preview',
  requireAuth,
  requirePermission('notificationTemplate.read'),
  asyncHandler(notificationTemplateController.preview),
);

router.get(
  '/',
  requireAuth,
  requirePermission('notificationTemplate.read'),
  asyncHandler(notificationTemplateController.list),
);

router.post(
  '/',
  requireAuth,
  requirePermission('notificationTemplate.create'),
  asyncHandler(notificationTemplateController.create),
);

router.get(
  '/:id',
  requireAuth,
  requirePermission('notificationTemplate.read'),
  asyncHandler(notificationTemplateController.getById),
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('notificationTemplate.update'),
  asyncHandler(notificationTemplateController.update),
);

router.post(
  '/:id/preview',
  requireAuth,
  requirePermission('notificationTemplate.read'),
  asyncHandler(notificationTemplateController.preview),
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('notificationTemplate.delete'),
  asyncHandler(notificationTemplateController.remove),
);

module.exports = router;
