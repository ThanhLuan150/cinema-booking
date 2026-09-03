const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A self-service ticketing kiosk in a Branch lobby (Ticket 31). Modelled on Device (the QR
// scanner): `kiosk_code` is the stable printed hardware id (unique system-wide), `id` is the
// numeric surrogate every other model uses. Auth is by API key in the `X-Kiosk-Key` header —
// only the SHA-256 hash is stored (see utils/kioskKey), the plaintext is shown once at
// creation / rotation. `guest_account_id` is a hidden Account created with the kiosk: every
// Booking / Payment / Invoice a kiosk produces is attributed to it (the kiosk is unattended
// and the customer never signs in), and giving each kiosk its own account keeps seat-lock
// ownership genuinely isolated between kiosks.
const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

const kioskSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    kiosk_code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    branch_id: { type: Number, required: true, index: true },
    guest_account_id: { type: Number, required: true, index: true },
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
    api_key_hash: { type: String, required: true },
    last_seen_at: { type: Date, default: null },
  },
  { timestamps: true },
);

// Never leak the key hash over the API.
withCleanJSON(kioskSchema);
kioskSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.api_key_hash;
    return ret;
  },
});

const Kiosk = mongoose.model('Kiosk', kioskSchema);
Kiosk.STATUSES = STATUSES;

module.exports = Kiosk;
