const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireCinemaOwnership } = require('../middleware/ownership');
const roomRepository = require('../repositories/room.repository');
const roomController = require('../controllers/room.controller');

const router = express.Router();

// GET /api/room?cinemaId=
router.get('/', asyncHandler(roomController.list));

// POST /api/room { name, cinema_id } (admin or theater staff, owner-scoped)
router.post(
  '/',
  requireAuth,
  requireRole(0, 2),
  requireCinemaOwnership((req) => Number(req.body.cinema_id)),
  asyncHandler(roomController.create),
);

// PUT /api/room/:id { name } (admin or theater staff, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requireRole(0, 2),
  requireCinemaOwnership((req) => roomRepository.findCinemaIdByRoomId(req.params.id)),
  asyncHandler(roomController.update),
);

// DELETE /api/room/:id (admin or theater staff, owner-scoped)
router.delete(
  '/:id',
  requireAuth,
  requireRole(0, 2),
  requireCinemaOwnership((req) => roomRepository.findCinemaIdByRoomId(req.params.id)),
  asyncHandler(roomController.remove),
);

module.exports = router;
