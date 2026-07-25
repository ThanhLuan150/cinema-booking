const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const categoryController = require('../controllers/category.controller');

const router = express.Router();

// GET /api/cat
router.get('/', asyncHandler(categoryController.list));

// GET /api/cat/:id
router.get('/:id', asyncHandler(categoryController.getById));

// POST /api/cat (admin or theater staff)
router.post('/', requireAuth, requireRole(0, 2), asyncHandler(categoryController.create));

module.exports = router;
