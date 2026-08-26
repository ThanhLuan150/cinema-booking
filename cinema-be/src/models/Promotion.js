const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const DISCOUNT_TYPE = { PERCENTAGE: 'PERCENTAGE', FIXED_AMOUNT: 'FIXED_AMOUNT' };
const STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };

const promotionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    discount_type: { type: String, enum: Object.values(DISCOUNT_TYPE), required: true },
    discount_value: { type: Number, required: true, min: 0 },
    minimum_order_value: { type: Number, default: 0 },
    maximum_discount: { type: Number, default: null }, // cap on the computed discount (mainly for PERCENTAGE)
    start_at: { type: Date, required: true },
    end_at: { type: Date, required: true },
    usage_limit: { type: Number, default: null }, // null = unlimited total uses
    used_count: { type: Number, default: 0 },
    per_customer_limit: { type: Number, default: null }, // null = unlimited uses per customer
    status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE, index: true },
    branch_ids: { type: [Number], default: [] },
    movie_ids: { type: [Number], default: [] },
    showtime_ids: { type: [Number], default: [] },
    combo_ids: { type: [Number], default: [] },
  },
  { timestamps: true },
);

withCleanJSON(promotionSchema);

const Promotion = mongoose.model('Promotion', promotionSchema);
Promotion.DISCOUNT_TYPE = DISCOUNT_TYPE;
Promotion.STATUS = STATUS;

module.exports = Promotion;
