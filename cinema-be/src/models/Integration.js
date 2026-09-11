const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// A registered third-party service the platform can call out to or receive webhooks from.
// `secret_env_var` is only ever the NAME of an environment variable (e.g. "MOMO_SECRET_KEY")
// — the actual secret value is never stored here and never leaves process.env, so there is
// nothing sensitive in this document to accidentally expose via the API.
const integrationSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    // The provider key inbound webhooks are matched on (POST /api/webhooks/:provider), e.g.
    // "MOMO", "SENDGRID", "TWILIO". Uppercased so lookups are case-insensitive by convention.
    provider: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: {
      type: String,
      enum: [
        'PAYMENT_GATEWAY',
        'EMAIL_PROVIDER',
        'SMS_PROVIDER',
        'CLOUD_STORAGE',
        'ACCOUNTING_SYSTEM',
        'THIRD_PARTY_TICKETING',
      ],
      required: true,
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    // Non-secret settings only (endpoint URLs, sender ids, bucket names, ...).
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    secret_env_var: { type: String, default: null, trim: true },
    description: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

withCleanJSON(integrationSchema);

const Integration = mongoose.model('Integration', integrationSchema);
Integration.TYPES = {
  PAYMENT_GATEWAY: 'PAYMENT_GATEWAY',
  EMAIL_PROVIDER: 'EMAIL_PROVIDER',
  SMS_PROVIDER: 'SMS_PROVIDER',
  CLOUD_STORAGE: 'CLOUD_STORAGE',
  ACCOUNTING_SYSTEM: 'ACCOUNTING_SYSTEM',
  THIRD_PARTY_TICKETING: 'THIRD_PARTY_TICKETING',
};
Integration.STATUSES = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

module.exports = Integration;
