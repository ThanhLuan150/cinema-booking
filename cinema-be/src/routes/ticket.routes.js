const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const ticketController = require('../controllers/ticket.controller');

const router = express.Router();

// POST /api/ticket { schedule_id } -> generates the seat grid for a schedule from the room's seat map
// (admin only, since schedules are now admin-managed). Maintenance-locked seats are excluded from
// the bookable grid.
router.post('/', requireAuth, requireRole(0), asyncHandler(ticketController.create));

// PUT /api/ticket/:id -> mark a ticket as booked/sold (auth required)
router.put('/:id', requireAuth, asyncHandler(ticketController.markSold));

module.exports = router;
