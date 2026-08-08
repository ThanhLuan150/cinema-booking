const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const movieActorController = require('../controllers/movieActor.controller');

const router = express.Router();

// GET /api/movieActor -> full list of { id, movie_id, actor_id, character_name, is_lead } mappings
router.get('/', asyncHandler(movieActorController.list));

// GET /api/movieActor/:movieId -> mappings for that movie
router.get('/:movieId', asyncHandler(movieActorController.getForMovie));

// POST /api/movieActor { movie_id, actor_id, character_name, is_lead } -> movie.update permission
router.post('/', requireAuth, requirePermission('movie.update'), asyncHandler(movieActorController.create));

// DELETE /api/movieActor/:movieId -> delete all mappings for that movie (movie.update permission)
router.delete('/:movieId', requireAuth, requirePermission('movie.update'), asyncHandler(movieActorController.removeForMovie));

module.exports = router;
