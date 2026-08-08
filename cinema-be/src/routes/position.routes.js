const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const positionController = require('../controllers/position.controller');

const router = express.Router();

// GET /api/position -> active positions (position.read permission — branch admin/super admin,
router.get('/', requireAuth, requirePermission('position.read'), asyncHandler(positionController.list));

module.exports = router;
