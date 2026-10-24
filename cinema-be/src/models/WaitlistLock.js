const mongoose = require('mongoose');

const waitlistLockSchema = new mongoose.Schema(
  {
    schedule_id: { type: Number, required: true, unique: true },
    owner: { type: String, default: null },
    locked_until: { type: Date, default: null },
    rerun: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('WaitlistLock', waitlistLockSchema);
