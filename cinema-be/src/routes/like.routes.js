const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const likeController = require('../controllers/like.controller');

const router = express.Router();

// GET /api/like/mine -> movies the caller has liked, joined with movie + category details (auth required)
router.get('/like/mine', requireAuth, asyncHandler(likeController.mine));

// GET /api/like/:movieId -> like count (number)
router.get('/like/:movieId', asyncHandler(likeController.count));

// POST /api/like { movie_id } (auth required)
router.post('/like', requireAuth, asyncHandler(likeController.like));

// POST /api/unlike { movie_id } (auth required)
router.post('/unlike', requireAuth, asyncHandler(likeController.unlike));

module.exports = router;
