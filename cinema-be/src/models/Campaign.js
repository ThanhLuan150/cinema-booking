const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const TARGET_TYPE = {
  ALL_CUSTOMERS: 'ALL_CUSTOMERS', // every active customer account
  MEMBERS: 'MEMBERS', // customers who have reached a membership tier above NONE
  BRANCH_CUSTOMERS: 'BRANCH_CUSTOMERS', // customers with a booking at / favourite of the campaign's branch
};

// The admin's *intent*. It is never mutated by the passage of time — whether a campaign is
// currently on air is derived from this plus the [start_at, end_at] window by
// utils/campaignWindow, so an expired campaign needs no sweep job to stop being displayed.
const STATUS = {
  DRAFT: 'DRAFT', // being authored; never displayed, cannot send notifications
  ACTIVE: 'ACTIVE', // on air whenever "now" falls inside the window
  PAUSED: 'PAUSED', // temporarily pulled without losing the window
  ARCHIVED: 'ARCHIVED', // retired; kept for reporting/audit, never displayed
};

const campaignSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.DRAFT, index: true },
    target_type: { type: String, enum: Object.values(TARGET_TYPE), default: TARGET_TYPE.ALL_CUSTOMERS, index: true },

    // null = Global Campaign (SUPER_ADMIN only). Otherwise the owning branch.
    branch_id: { type: Number, default: null, index: true },

    // Linked catalogue entities. Plain id lists — a campaign never owns a Movie or a Promotion,
    // it only points at them, and a dangling id is dropped at read time rather than cascading.
    movie_ids: { type: [Number], default: [] },
    promotion_ids: { type: [Number], default: [] },

    // ---- Notification link -------------------------------------------------
    notification_enabled: { type: Boolean, default: false },
    notification_title: { type: String, default: '' },
    notification_body: { type: String, default: '' },
    notification_last_sent_at: { type: Date, default: null },
    notification_sent_count: { type: Number, default: 0 },

    created_by: { type: Number, default: null, index: true },
  },
  { timestamps: true },
);

campaignSchema.index({ branch_id: 1, status: 1, start_at: 1, end_at: 1 });

withCleanJSON(campaignSchema);

const Campaign = mongoose.model('Campaign', campaignSchema);
Campaign.STATUS = STATUS;
Campaign.TARGET_TYPE = TARGET_TYPE;

module.exports = Campaign;
