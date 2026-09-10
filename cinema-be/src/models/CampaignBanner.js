const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const PLACEMENT = {
  HOME_HERO: 'HOME_HERO',
  HOME_STRIP: 'HOME_STRIP',
  MOVIE_DETAIL: 'MOVIE_DETAIL',
  BOOKING: 'BOOKING',
};

const STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

const campaignBannerSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    campaign_id: { type: Number, required: true, index: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    image_url: { type: String, required: true, trim: true },
    // Where clicking the banner takes the customer. Free-form so it can point at an internal
    // route (/Detail/12) or an external landing page.
    link_url: { type: String, default: '' },
    placement: { type: String, enum: Object.values(PLACEMENT), default: PLACEMENT.HOME_STRIP, index: true },
    // Lower shows first within a placement.
    sort_order: { type: Number, default: 0 },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE, index: true },
  },
  { timestamps: true },
);

campaignBannerSchema.index({ campaign_id: 1, sort_order: 1 });

withCleanJSON(campaignBannerSchema);

const CampaignBanner = mongoose.model('CampaignBanner', campaignBannerSchema);
CampaignBanner.PLACEMENT = PLACEMENT;
CampaignBanner.STATUS = STATUS;

module.exports = CampaignBanner;
