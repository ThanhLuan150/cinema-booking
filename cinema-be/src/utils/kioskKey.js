const crypto = require('crypto');

// API key a self-service kiosk presents in the `X-Kiosk-Key` header. The plaintext is returned
// to the operator exactly once (kiosk creation / key rotation); only the hash is persisted, so
// a database leak can't be replayed against the kiosk booking endpoints. Mirrors utils/deviceKey.
function generateKioskKey() {
  return `KIOSK-${crypto.randomBytes(24).toString('hex')}`;
}

function hashKioskKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

module.exports = { generateKioskKey, hashKioskKey };
