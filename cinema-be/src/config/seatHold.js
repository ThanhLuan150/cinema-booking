// How long a held seat stays reserved (Ticket 27's BOOKING_HOLD_TIME, managed via
// systemConfig.service) no longer lives here — this file now only holds the sweep's own polling
// interval, an operational/infra knob rather than a business setting.
const SWEEP_INTERVAL_MS = Number(process.env.SEAT_HOLD_SWEEP_INTERVAL_MS) || 30 * 1000;

module.exports = { SWEEP_INTERVAL_MS };
