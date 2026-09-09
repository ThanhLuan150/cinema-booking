const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A digital-signage display mounted somewhere inside a Branch (lobby wall, box-office queue,
// concessions counter). `device_id` is the stable hardware identifier the operator prints on
// the media player driving the screen (unique system-wide when set); `id` is the numeric
// surrogate key every other model in this system uses. A Screen only ever plays Content that
// belongs to its own Branch — see services/signagePlayback.resolvePlayback.
//
// The media player authenticates itself with an API key (X-Screen-Key header); only the
// SHA-256 hash is stored here — the plaintext is shown once, at creation / key rotation.
const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

const screenSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    location: { type: String, default: '' }, // free-text placement, e.g. "Main lobby - north wall"
    device_id: { type: String, default: '', index: true }, // hardware id of the media player
    status: { type: String, enum: STATUSES, default: 'ACTIVE', index: true },
    api_key_hash: { type: String, default: null },
    last_seen_at: { type: Date, default: null },
  },
  { timestamps: true },
);

// Never leak the key hash over the API.
withCleanJSON(screenSchema);
screenSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.api_key_hash;
    return ret;
  },
});

const Screen = mongoose.model('Screen', screenSchema);
Screen.STATUSES = STATUSES;

module.exports = Screen;
