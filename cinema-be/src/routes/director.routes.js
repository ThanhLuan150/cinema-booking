const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const upload = require('../middleware/upload');
const directorController = require('../controllers/director.controller');

const router = express.Router();

const uploadDirectorAvatar = upload.fields([{ name: 'avatar_url', maxCount: 1 }]);

// GET /api/director?page=&limit=
router.get('/', asyncHandler(directorController.list));

// GET /api/director/:id
router.get('/:id', asyncHandler(directorController.getById));

// POST /api/director (shared catalog — gated by the director.create permission, granted to Super Admin only)
router.post(
  '/',
  requireAuth,
  requirePermission('director.create'),
  uploadDirectorAvatar,
  asyncHandler(directorController.create),
);

// PUT /api/director/:id (director.update permission)
router.put('/:id', requireAuth, requirePermission('director.update'), asyncHandler(directorController.update));

// DELETE /api/director/:id (director.delete permission)
router.delete('/:id', requireAuth, requirePermission('director.delete'), asyncHandler(directorController.remove));

module.exports = router;
