const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');
const Account = require('./Account');

const membershipLevelSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, enum: Account.MEMBERSHIP_LEVELS },
    name: { type: String, required: true }, // customer-facing display name, e.g. "Standard", "Silver"
    min_points: { type: Number, required: true, min: 0 }, // lifetime points required to reach this tier
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

withCleanJSON(membershipLevelSchema);

module.exports = mongoose.model('MembershipLevel', membershipLevelSchema);
