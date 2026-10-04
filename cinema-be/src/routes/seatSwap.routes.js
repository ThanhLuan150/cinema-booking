const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const seatSwapController = require('../controllers/seatSwap.controller');

const router = express.Router();

// :id is the issued ticket (Invoice id) — the same id as GET /api/my-tickets/:id. Whose ticket it is
// (OWN / BRANCH / ALL) is checked by the service, after the permission resolves the scope.

// GET /api/tickets/:id/seat-swap -> eligibility, policy, current seat
router.get('/:id/seat-swap', requireAuth, requirePermission('ticket.swapSeat'), asyncHandler(seatSwapController.options));

// POST /api/tickets/:id/seat-swap/quote { seat_code } -> availability + price difference (no writes)
router.post(
  '/:id/seat-swap/quote',
  requireAuth,
  requirePermission('ticket.swapSeat'),
  asyncHandler(seatSwapController.quote),
);

// POST /api/tickets/:id/seat-swap { seat_code } -> moves the ticket to the new seat
router.post('/:id/seat-swap', requireAuth, requirePermission('ticket.swapSeat'), asyncHandler(seatSwapController.swap));

module.exports = router;
