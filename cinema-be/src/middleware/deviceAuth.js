const deviceRepository = require('../repositories/device.repository');
const { hashDeviceKey } = require('../utils/deviceKey');

// Authenticates a QR scanner by the API key it presents in the `X-Device-Key` header (the
// device-facing counterpart to requireAuth's JWT bearer check for humans). On success it sets
// `req.device` and refreshes `last_seen_at`; a MAINTENANCE/INACTIVE unit is rejected so a
// decommissioned scanner can't keep admitting tickets.
async function requireDevice(req, res, next) {
  try {
    const key = req.headers['x-device-key'];
    if (!key) return res.status(401).json({ message: 'Missing device key', code: 'DEVICE_KEY_MISSING' });

    const device = await deviceRepository.findByApiKeyHash(hashDeviceKey(key));
    if (!device) return res.status(401).json({ message: 'Invalid device key', code: 'DEVICE_KEY_INVALID' });
    if (device.status !== 'ACTIVE') {
      return res.status(403).json({ message: `Device is ${device.status}`, code: 'DEVICE_NOT_ACTIVE' });
    }

    req.device = device;
    // Fire-and-forget: a heartbeat write must not delay or fail the scan.
    deviceRepository.touchLastSeen(device.id).catch(() => {});
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireDevice };
