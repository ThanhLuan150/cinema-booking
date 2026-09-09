const signageRepository = require('../repositories/signage.repository');
const { hashScreenKey } = require('../utils/screenKey');

// Authenticates a digital-signage screen by the API key it presents in the `X-Screen-Key`
// header (the screen-facing counterpart to requireAuth's JWT bearer check for humans). On
// success it sets `req.screen` and refreshes `last_seen_at`; a MAINTENANCE / INACTIVE unit is
// rejected so a decommissioned screen stops pulling content. Mirrors middleware/deviceAuth.
async function requireScreen(req, res, next) {
  try {
    const key = req.headers['x-screen-key'];
    if (!key) return res.status(401).json({ message: 'Missing screen key', code: 'SCREEN_KEY_MISSING' });

    const screen = await signageRepository.findScreenByApiKeyHash(hashScreenKey(key));
    if (!screen) return res.status(401).json({ message: 'Invalid screen key', code: 'SCREEN_KEY_INVALID' });
    if (screen.status !== 'ACTIVE') {
      return res.status(403).json({ message: `Screen is ${screen.status}`, code: 'SCREEN_NOT_ACTIVE' });
    }

    req.screen = screen;
    // Fire-and-forget: a heartbeat write must not delay or fail the poll.
    signageRepository.touchScreenLastSeen(screen.id).catch(() => {});
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireScreen };
