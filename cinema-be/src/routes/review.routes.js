const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const reviewController = require('../controllers/review.controller');

const router = express.Router();

// GET /api/review -> all reviews including hidden ones, joined with movie/cinema name (review.moderate permission)
router.get('/', requireAuth, requirePermission('review.moderate'), asyncHandler(reviewController.listForModeration));

// GET /api/review/cinema/:cinemaId -> visible reviews (with replies) for a cinema + average rating;
// optionalAuth so a logged-in viewer's own reaction is flagged without requiring login to view
router.get('/cinema/:cinemaId', optionalAuth, asyncHandler(reviewController.listForCinema));

// GET /api/review/:movieId -> visible reviews (with replies) for a movie + average rating
router.get('/:movieId', optionalAuth, asyncHandler(reviewController.listForMovie));

// POST /api/review { movie_id | cinema_id, rating, comment } -> create or update the caller's own
// top-level review, or { movie_id | cinema_id, parent_id, comment } -> post a reply (auth required)
router.post('/', requireAuth, asyncHandler(reviewController.create));

// PUT /api/review/:id { rating?, comment } -> the review's own author edits it (auth required)
router.put('/:id', requireAuth, asyncHandler(reviewController.update));

// POST /api/review/:id/react { type } -> toggle the caller's reaction (auth required)
router.post('/:id/react', requireAuth, asyncHandler(reviewController.react));

// POST /api/review/:id/report { reason } -> flag someone else's review/reply (auth required)
router.post('/:id/report', requireAuth, asyncHandler(reviewController.report));

// PUT /api/review/:id/hide (review.moderate permission)
router.put('/:id/hide', requireAuth, requirePermission('review.moderate'), asyncHandler(reviewController.hide));

// DELETE /api/review/:id (admin, or the review's own author)
router.delete('/:id', requireAuth, asyncHandler(reviewController.remove));

module.exports = router;
