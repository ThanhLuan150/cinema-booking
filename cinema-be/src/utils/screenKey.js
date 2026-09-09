const crypto = require('crypto');

// API key a digital-signage screen (its media player) presents in the `X-Screen-Key` header to
// pull its own playlist. The plaintext is returned to the operator exactly once (screen
// creation / key rotation); only the hash is persisted, so a database leak can't be replayed
// against the playback endpoint. Mirrors utils/deviceKey.
function generateScreenKey() {
  return `SCR-${crypto.randomBytes(24).toString('hex')}`;
}

function hashScreenKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

module.exports = { generateScreenKey, hashScreenKey };
