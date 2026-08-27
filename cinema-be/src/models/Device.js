const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A QR scanner mounted at a Branch entrance. `device_id` is the stable hardware identifier the
// operator prints on the unit (unique system-wide); `id` is the numeric surrogate key every
// other model in this system uses. Authentication is by API key: only the SHA-256 hash of the
// key is stored here (see utils/deviceKey) — the plaintext is shown once, at creation / rotation.
const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

const deviceSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    device_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    branch_id: { type: Number, required: true, index: true },
    entrance_id: { type: Number, default: null, index: true },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
    api_key_hash: { type: String, required: true },
    last_seen_at: { type: Date, default: null },
  },
  { timestamps: true },
);

// Never leak the key hash over the API.
withCleanJSON(deviceSchema);
deviceSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.api_key_hash;
    return ret;
  },
});

const Device = mongoose.model('Device', deviceSchema);
Device.STATUSES = STATUSES;

module.exports = Device;
