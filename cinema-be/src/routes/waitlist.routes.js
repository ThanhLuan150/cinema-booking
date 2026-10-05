const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const waitlistController = require('../controllers/waitlist.controller');

const router = express.Router();

// Showtime Waitlist (Ticket 51). Entries are personal: whatever the permission's scope, each route
// only ever reads or changes the caller's own.

router.get('/', requireAuth, requirePermission('waitlist.read'), asyncHandler(waitlistController.listMine));

router.get(
  '/showtimes/:scheduleId',
  requireAuth,
  requirePermission('waitlist.read'),
  asyncHandler(waitlistController.showtimeStatus),
);

router.post('/', requireAuth, requirePermission('waitlist.join'), asyncHandler(waitlistController.join));

router.get('/:id', requireAuth, requirePermission('waitlist.read'), asyncHandler(waitlistController.getMine));

router.post('/:id/cancel', requireAuth, requirePermission('waitlist.join'), asyncHandler(waitlistController.cancelMine));

module.exports = router;
