const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const upload = require('../middleware/upload');
const actorController = require('../controllers/actor.controller');

const router = express.Router();

const uploadActorAvatar = upload.fields([{ name: 'avatar_url', maxCount: 1 }]);

// GET /api/actor?page=&limit=
router.get('/', asyncHandler(actorController.list));

// GET /api/actor/:id
router.get('/:id', asyncHandler(actorController.getById));

// POST /api/actor (shared catalog — gated by the actor.create permission, granted to Super Admin only)
router.post(
  '/',
  requireAuth,
  requirePermission('actor.create'),
  uploadActorAvatar,
  asyncHandler(actorController.create),
);

// PUT /api/actor/:id (actor.update permission)
router.put('/:id', requireAuth, requirePermission('actor.update'), asyncHandler(actorController.update));

// DELETE /api/actor/:id (actor.delete permission)
router.delete('/:id', requireAuth, requirePermission('actor.delete'), asyncHandler(actorController.remove));

module.exports = router;
