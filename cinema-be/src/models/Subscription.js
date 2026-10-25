const mongoose = require('mongoose');
const { benefitsSchema } = require('./membershipBenefits');

const STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};
const OPEN_STATUSES = [STATUS.PENDING_PAYMENT, STATUS.ACTIVE];

const planSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    duration_days: { type: Number, required: true },
    benefits: { type: benefitsSchema, default: () => ({}) },
  },
  { _id: false },
);

const subscriptionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    // = its Payment's code, so the shared MoMo IPN can route the result here.
    code: { type: String, required: true, unique: true },
    account_id: { type: Number, required: true, index: true },
    plan_id: { type: Number, required: true, index: true },
    plan: { type: planSnapshotSchema, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.PENDING_PAYMENT, index: true },
    start_at: { type: Date, default: null },
    end_at: { type: Date, default: null, index: true },
    // Free tickets of this term already spent (or reserved by a booking awaiting payment). Only ever
    // moved by a conditional $inc that also re-checks the term, so it cannot pass plan.benefits.free_tickets.
    tickets_used: { type: Number, default: 0, min: 0 },
    payment_id: { type: Number, default: null },
    payment_expires_at: { type: Date, default: null }, // PENDING_PAYMENT only
    paid_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    cancel_reason: { type: String, default: null },
    cancelled_by: { type: Number, default: null },
    expired_at: { type: Date, default: null },
    // = String(account_id) while PENDING_PAYMENT or ACTIVE, unset otherwise. The unique sparse index
    // is what makes "at most one open subscription per customer" hold under concurrent purchases.
    open_key: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

subscriptionSchema.index({ account_id: 1, status: 1, end_at: 1 });
subscriptionSchema.index({ status: 1, payment_expires_at: 1 });

// withCleanJSON, plus open_key: it is uniqueness machinery, not something a client reads.
subscriptionSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.open_key;
    return ret;
  },
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);
Subscription.STATUS = STATUS;
Subscription.OPEN_STATUSES = OPEN_STATUSES;

module.exports = Subscription;
