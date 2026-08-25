const crypto = require('crypto');

// Opaque, unguessable reference used as a Ticket's QR payload. Carries no ticket/booking/
// payment data itself — the scanner always resolves it server-side via findTicketViewByQrToken.
function generateQrToken() {
  return `TCK-${crypto.randomBytes(24).toString('hex')}`;
}

module.exports = { generateQrToken };
