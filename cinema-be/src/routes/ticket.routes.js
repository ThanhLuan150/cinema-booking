const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireCinemaAccess } = require('../middleware/permission');
const bookingRepository = require('../repositories/booking.repository');
const ticketController = require('../controllers/ticket.controller');

const router = express.Router();

// POST /api/ticket { schedule_id } -> generates the seat grid for a schedule from the room's seat map
router.post('/', requireAuth, requirePermission('ticket.generate'), asyncHandler(ticketController.create));

// PUT /api/ticket/:id -> mark a ticket as booked/sold (ticket.checkin permission, cinema-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('ticket.checkin'),
  requireCinemaAccess((req) => bookingRepository.findCinemaIdByTicketId(req.params.id)),
  asyncHandler(ticketController.markSold),
);

module.exports = router;
