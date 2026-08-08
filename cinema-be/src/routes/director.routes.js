const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const directorController = require('../controllers/director.controller');

const router = express.Router();

// GET /api/director?page=&limit=
router.get('/', asyncHandler(directorController.list));

// GET /api/director/:id
router.get('/:id', asyncHandler(directorController.getById));

// POST /api/director (shared catalog — gated by the director.create permission, granted to Super Admin only)
router.post('/', requireAuth, requirePermission('director.create'), asyncHandler(directorController.create));

// PUT /api/director/:id (director.update permission)
router.put('/:id', requireAuth, requirePermission('director.update'), asyncHandler(directorController.update));

// DELETE /api/director/:id (director.delete permission)
router.delete('/:id', requireAuth, requirePermission('director.delete'), asyncHandler(directorController.remove));

module.exports = router;
