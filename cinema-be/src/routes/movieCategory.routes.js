const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const movieCategoryController = require('../controllers/movieCategory.controller');

const router = express.Router();

// GET /api/movieCat  -> full list of { id, movie_id, cat_id } mappings
router.get('/', asyncHandler(movieCategoryController.list));

// GET /api/movieCat/:movieId -> array of category ids for that movie
router.get('/:movieId', asyncHandler(movieCategoryController.getCategoryIdsForMovie));

// POST /api/movieCat { movie_id, cat_id } (admin or theater staff)
router.post('/', requireAuth, requireRole(0, 2), asyncHandler(movieCategoryController.create));

// DELETE /api/movieCat/:movieId -> delete all mappings for that movie (admin or theater staff)
router.delete('/:movieId', requireAuth, requireRole(0, 2), asyncHandler(movieCategoryController.removeForMovie));

module.exports = router;
