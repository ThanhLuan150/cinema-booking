const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const movieCategoryController = require('../controllers/movieCategory.controller');

const router = express.Router();

// GET /api/movieCat  -> full list of { id, movie_id, cat_id } mappings
router.get('/', asyncHandler(movieCategoryController.list));

// GET /api/movieCat/:movieId -> array of category ids for that movie
router.get('/:movieId', asyncHandler(movieCategoryController.getCategoryIdsForMovie));

// POST /api/movieCat { movie_id, cat_id } -> tagging a movie's categories is part of editing
// the movie, so it's gated by movie.update (same permission as PUT /movie/:id)
router.post('/', requireAuth, requirePermission('movie.update'), asyncHandler(movieCategoryController.create));

// DELETE /api/movieCat/:movieId -> delete all mappings for that movie (movie.update permission)
router.delete('/:movieId', requireAuth, requirePermission('movie.update'), asyncHandler(movieCategoryController.removeForMovie));

module.exports = router;
