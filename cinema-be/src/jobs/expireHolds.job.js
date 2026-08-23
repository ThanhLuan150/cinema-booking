const bookingRepository = require('../repositories/booking.repository');
const { SWEEP_INTERVAL_MS } = require('../config/seatHold');

function startSeatHoldSweep() {
  const timer = setInterval(() => {
    bookingRepository.expireAllHeldTickets().catch((err) => {
      console.error('[seatHoldSweep] failed to expire held tickets', err);
    });
    bookingRepository.expireStalePendingBookings().catch((err) => {
      console.error('[seatHoldSweep] failed to expire stale pending bookings', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startSeatHoldSweep };
