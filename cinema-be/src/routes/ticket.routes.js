const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const ticketController = require('../controllers/ticket.controller');

const router = express.Router();

// POST /api/ticket { schedule_id } -> generates the seat grid for a schedule from the room's seat map
// (ticket.generate permission — super admin only, since schedules are admin-managed). Maintenance-locked
// seats are excluded from the bookable grid.
router.post('/', requireAuth, requirePermission('ticket.generate'), asyncHandler(ticketController.create));

// PUT /api/ticket/:id -> mark a ticket as booked/sold (auth required)
router.put('/:id', requireAuth, asyncHandler(ticketController.markSold));

module.exports = router;
