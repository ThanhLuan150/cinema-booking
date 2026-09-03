const kioskRepository = require('../repositories/kiosk.repository');
const { hashKioskKey } = require('../utils/kioskKey');

// Authenticates a self-service kiosk by the API key it presents in the `X-Kiosk-Key` header
// (the kiosk-facing counterpart to requireAuth's JWT bearer check for humans). On success it
// sets `req.kiosk` and refreshes `last_seen_at`; a MAINTENANCE / INACTIVE unit is rejected so a
// decommissioned kiosk can't keep selling tickets. Mirrors middleware/deviceAuth.requireDevice.
async function requireKiosk(req, res, next) {
  try {
    const key = req.headers['x-kiosk-key'];
    if (!key) return res.status(401).json({ message: 'Missing kiosk key', code: 'KIOSK_KEY_MISSING' });

    const kiosk = await kioskRepository.findByApiKeyHash(hashKioskKey(key));
    if (!kiosk) return res.status(401).json({ message: 'Invalid kiosk key', code: 'KIOSK_KEY_INVALID' });
    if (kiosk.status !== 'ACTIVE') {
      return res.status(403).json({ message: `Kiosk is ${kiosk.status}`, code: 'KIOSK_NOT_ACTIVE' });
    }

    req.kiosk = kiosk;
    // Fire-and-forget: a heartbeat write must not delay or fail the request.
    kioskRepository.touchLastSeen(kiosk.id).catch(() => {});
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireKiosk };
