const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const reviewController = require('../controllers/review.controller');

const router = express.Router();

// GET /api/review -> all reviews including hidden/rejected ones, joined with movie/cinema name
// (review.view permission, ALL scope — moderation dashboard)
router.get('/', requireAuth, requirePermission('review.view'), asyncHandler(reviewController.listForModeration));

// GET /api/review/my -> the caller's own reviews across all statuses (review.view permission, OWN scope)
router.get('/my', requireAuth, requirePermission('review.view'), asyncHandler(reviewController.listOwn));

// GET /api/review/cinema/:branchId -> visible reviews (with replies) for a cinema + average rating;
// optionalAuth so a logged-in viewer's own reaction is flagged without requiring login to view
router.get('/cinema/:branchId', optionalAuth, asyncHandler(reviewController.listForCinema));

// GET /api/review/movie/:movieId/eligible-bookings -> the caller's own paid+used-ticket bookings
// for this movie that haven't been reviewed yet (auth required; Ticket 33 eligibility rule)
router.get('/movie/:movieId/eligible-bookings', requireAuth, asyncHandler(reviewController.listEligibleBookings));

// GET /api/review/:movieId -> visible reviews (with replies) for a movie + average rating
router.get('/:movieId', optionalAuth, asyncHandler(reviewController.listForMovie));

// POST /api/review { movie_id, booking_id, rating, comment } -> a verified-purchase movie review
// (review.create permission), { cinema_id, rating, comment } -> a cinema review, or
// { movie_id | cinema_id, parent_id, comment } -> a reply (auth required)
router.post('/', requireAuth, requirePermission('review.create'), asyncHandler(reviewController.create));

// PUT /api/review/:id { rating?, comment } -> the review's own author edits it
// (review.update_own permission; ALL scope may edit any review)
router.put('/:id', requireAuth, requirePermission('review.update_own'), asyncHandler(reviewController.update));

// POST /api/review/:id/react { type } -> toggle the caller's reaction (auth required)
router.post('/:id/react', requireAuth, asyncHandler(reviewController.react));

// POST /api/review/:id/report { reason } -> flag someone else's review/reply (auth required)
router.post('/:id/report', requireAuth, asyncHandler(reviewController.report));

// PUT /api/review/:id/hide (review.moderate permission)
router.put('/:id/hide', requireAuth, requirePermission('review.moderate'), asyncHandler(reviewController.hide));

// PUT /api/review/:id/reject (review.moderate permission)
router.put('/:id/reject', requireAuth, requirePermission('review.moderate'), asyncHandler(reviewController.reject));

// PUT /api/review/:id/restore (review.moderate permission)
router.put('/:id/restore', requireAuth, requirePermission('review.moderate'), asyncHandler(reviewController.restore));

// DELETE /api/review/:id (review.delete_own permission; ALL scope may delete any review)
router.delete('/:id', requireAuth, requirePermission('review.delete_own'), asyncHandler(reviewController.remove));

module.exports = router;
