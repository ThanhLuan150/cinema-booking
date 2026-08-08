const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireCinemaOwnership } = require('../middleware/ownership');
const roomRepository = require('../repositories/room.repository');
const seatRepository = require('../repositories/seat.repository');
const seatController = require('../controllers/seat.controller');

const router = express.Router();

// GET /api/seat/room/:roomId -> seat map for a room (public — needed to render the seat picker)
router.get('/room/:roomId', asyncHandler(seatController.listByRoom));

// POST /api/seat/room/:roomId/generate { rows, seatsPerRow, vipRows, coupleRows } -> (re)creates the seat map
router.post(
  '/room/:roomId/generate',
  requireAuth,
  requirePermission('seat.create'),
  requireCinemaOwnership((req) => roomRepository.findCinemaIdByRoomId(req.params.roomId)),
  asyncHandler(seatController.generate),
);

// PUT /api/seat/:id { seat_type, is_locked } (seat.update permission, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('seat.update'),
  requireCinemaOwnership(async (req) => {
    const seat = await seatRepository.findById(req.params.id);
    if (!seat) return null;
    return roomRepository.findCinemaIdByRoomId(seat.room_id);
  }),
  asyncHandler(seatController.update),
);

module.exports = router;
