const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const reviewController = require('../controllers/review.controller');

const router = express.Router();

// GET /api/review -> all reviews including hidden ones, joined with movie/cinema name (admin only — moderation)
router.get('/', requireAuth, requireRole(0), asyncHandler(reviewController.listForModeration));

// GET /api/review/cinema/:cinemaId -> visible reviews for a cinema + average rating
router.get('/cinema/:cinemaId', asyncHandler(reviewController.listForCinema));

// GET /api/review/:movieId -> visible reviews for a movie + average rating
router.get('/:movieId', asyncHandler(reviewController.listForMovie));

// POST /api/review { movie_id | cinema_id, rating, comment } -> create or update the caller's own
// review for exactly one target (auth required)
router.post('/', requireAuth, asyncHandler(reviewController.create));

// PUT /api/review/:id/hide (admin only — moderation)
router.put('/:id/hide', requireAuth, requireRole(0), asyncHandler(reviewController.hide));

// DELETE /api/review/:id (admin, or the review's own author)
router.delete('/:id', requireAuth, asyncHandler(reviewController.remove));

module.exports = router;
