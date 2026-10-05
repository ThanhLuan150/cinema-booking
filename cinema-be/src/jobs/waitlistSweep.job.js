const waitlistService = require('../services/waitlist.service');

// Seat releases reach the waitlist straight away (booking.repository); this sweep is for what no
// release announces — an offer running out, a showtime starting — and anything a release missed.
const SWEEP_INTERVAL_MS = Number(process.env.WAITLIST_SWEEP_INTERVAL_MS) || 30 * 1000;

function startWaitlistSweep() {
  const timer = setInterval(() => {
    waitlistService.sweep().catch((err) => {
      console.error('[waitlistSweep] failed to sweep waitlists', err);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startWaitlistSweep, SWEEP_INTERVAL_MS };
