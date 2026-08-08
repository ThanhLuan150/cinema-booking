const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const movieDirectorController = require('../controllers/movieDirector.controller');

const router = express.Router();

// GET /api/movieDirector -> full list of { id, movie_id, director_id } mappings
router.get('/', asyncHandler(movieDirectorController.list));

// GET /api/movieDirector/:movieId -> mappings for that movie
router.get('/:movieId', asyncHandler(movieDirectorController.getForMovie));

// POST /api/movieDirector { movie_id, director_id } -> movie.update permission
router.post('/', requireAuth, requirePermission('movie.update'), asyncHandler(movieDirectorController.create));

// DELETE /api/movieDirector/:movieId -> delete all mappings for that movie (movie.update permission)
router.delete('/:movieId', requireAuth, requirePermission('movie.update'), asyncHandler(movieDirectorController.removeForMovie));

module.exports = router;
