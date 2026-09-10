const crypto = require('crypto');

// Human-facing reference printed on the parking stub, e.g. "PK-3F9A2C7B10". Short enough to
// read back over a counter, wide enough (40 bits) that same-day collisions are negligible;
// the DB still has a unique index on ticket_code as the real guard.
function generateParkingTicketCode() {
  return `PK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

module.exports = { generateParkingTicketCode };
