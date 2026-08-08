const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const scheduleController = require('../controllers/schedule.controller');

const router = express.Router();

// GET /api/schedule -> management list (schedule.read permission). Admin sees every showtime;
// a theater owner sees showtimes for their own cinema(s); an employee sees only showtimes for
// the cinema they're staffed at.
router.get('/', requireAuth, requirePermission('schedule.read'), asyncHandler(scheduleController.list));

// GET /api/schedule/:id
router.get('/:id', asyncHandler(scheduleController.getById));

// POST /api/schedule { movie_id, room_id, movie_date, time_begin, time_end, price } (schedule.create
// permission — super admin only, since schedules are scheduled centrally, not by cinema owners)
router.post('/', requireAuth, requirePermission('schedule.create'), asyncHandler(scheduleController.create));

module.exports = router;
