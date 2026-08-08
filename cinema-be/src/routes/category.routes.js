const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const categoryController = require('../controllers/category.controller');

const router = express.Router();

// GET /api/cat
router.get('/', asyncHandler(categoryController.list));

// GET /api/cat/:id
router.get('/:id', asyncHandler(categoryController.getById));

// POST /api/cat (category.create permission)
router.post('/', requireAuth, requirePermission('category.create'), asyncHandler(categoryController.create));

module.exports = router;
