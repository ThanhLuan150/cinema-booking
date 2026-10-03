const bookingRepository = require('../repositories/booking.repository');
const inSeatOrderService = require('../services/inSeatOrder.service');
const { SWEEP_INTERVAL_MS } = require('../config/seatHold');

function startSeatHoldSweep() {
  const timer = setInterval(() => {
    bookingRepository.expireAllHeldTickets().catch((err) => {
      console.error('[seatHoldSweep] failed to expire held tickets', err);
    });
    bookingRepository.expireStalePendingBookings().catch((err) => {
      console.error('[seatHoldSweep] failed to expire stale pending bookings', err);
    });
    bookingRepository.expireIssuedTickets().catch((err) => {
      console.error('[seatHoldSweep] failed to expire issued tickets', err);
    });
    // In-seat F&B orders whose MoMo payment never arrived within the hold window (Ticket 49).
    inSeatOrderService.expireStalePendingOrders().catch((err) => {
      console.error('[seatHoldSweep] failed to expire unpaid in-seat orders', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startSeatHoldSweep };
