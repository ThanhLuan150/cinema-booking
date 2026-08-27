const crypto = require('crypto');

// API key a QR scanner presents in the `X-Device-Key` header. The plaintext is returned to the
// operator exactly once (device creation / key rotation); only the hash is persisted, so a
// database leak can't be replayed against the check-in endpoint.
function generateDeviceKey() {
  return `DEV-${crypto.randomBytes(24).toString('hex')}`;
}

function hashDeviceKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

module.exports = { generateDeviceKey, hashDeviceKey };
