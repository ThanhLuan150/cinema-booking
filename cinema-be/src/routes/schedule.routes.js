const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const roomRepository = require('../repositories/room.repository');
const scheduleRepository = require('../repositories/schedule.repository');
const scheduleController = require('../controllers/schedule.controller');

const router = express.Router();

// GET /api/schedule -> management list (schedule.read permission). Super admin sees every
// showtime; a branch admin/employee only sees showtimes for their own branch(es).
router.get('/', requireAuth, requirePermission('schedule.read'), asyncHandler(scheduleController.list));

// GET /api/schedule/:id
router.get('/:id', asyncHandler(scheduleController.getById));

// POST /api/schedule { movie_id, room_id, movie_date, time_begin, time_end, price }
// (schedule.create permission; branch-scoped to the room's own branch)
router.post(
  '/',
  requireAuth,
  requirePermission('schedule.create'),
  requireBranchOwnership((req) => roomRepository.findCinemaIdByRoomId(req.body.room_id)),
  asyncHandler(scheduleController.create),
);

// PUT /api/schedule/:id (schedule.update permission; branch-scoped to the showtime's own branch)
router.put(
  '/:id',
  requireAuth,
  requirePermission('schedule.update'),
  requireBranchOwnership((req) => scheduleRepository.findCinemaIdByScheduleId(req.params.id)),
  asyncHandler(scheduleController.update),
);

// PATCH /api/schedule/:id/cancel (schedule.cancel permission; branch-scoped)
router.patch(
  '/:id/cancel',
  requireAuth,
  requirePermission('schedule.cancel'),
  requireBranchOwnership((req) => scheduleRepository.findCinemaIdByScheduleId(req.params.id)),
  asyncHandler(scheduleController.cancel),
);

// PATCH /api/schedule/:id/reschedule { movie_date, time_begin, time_end } (schedule.reschedule
// permission; branch-scoped) — narrower than PUT /:id, only moves the showtime itself and
// cascades the customer-decision flow onto affected PAID bookings.
router.patch(
  '/:id/reschedule',
  requireAuth,
  requirePermission('schedule.reschedule'),
  requireBranchOwnership((req) => scheduleRepository.findCinemaIdByScheduleId(req.params.id)),
  asyncHandler(scheduleController.reschedule),
);

// DELETE /api/schedule/:id (schedule.delete permission; branch-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('schedule.delete'),
  requireBranchOwnership((req) => scheduleRepository.findCinemaIdByScheduleId(req.params.id)),
  asyncHandler(scheduleController.remove),
);

module.exports = router;
