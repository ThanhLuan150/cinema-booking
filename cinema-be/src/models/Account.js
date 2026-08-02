const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const accountSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: Number, default: 1 }, // 0 = admin, 1 = user, 2 = theater staff
    status: { type: Number, default: 1 }, // 1 = active, 0 = blocked
    approved: { type: Boolean, default: true }, // theater staff (role 2) start unapproved
    verified: { type: Boolean, default: false },
    otp: { type: String, default: null, select: false },
    otpExpiresAt: { type: Date, default: null, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
    refreshTokenExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

withCleanJSON(accountSchema);

module.exports = mongoose.model('Account', accountSchema);
