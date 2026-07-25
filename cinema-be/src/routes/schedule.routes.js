const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const scheduleController = require('../controllers/schedule.controller');

const router = express.Router();

// GET /api/schedule -> management list (admin or theater staff). Admin sees every showtime;
// a theater owner only sees showtimes in rooms that belong to their own cinema(s).
router.get('/', requireAuth, requireRole(0, 2), asyncHandler(scheduleController.list));

// GET /api/schedule/:id
router.get('/:id', asyncHandler(scheduleController.getById));

// POST /api/schedule { movie_id, room_id, movie_date, time_begin, time_end, price } (admin only —
// showtimes are scheduled centrally, not by individual cinema owners)
router.post('/', requireAuth, requireRole(0), asyncHandler(scheduleController.create));

module.exports = router;
