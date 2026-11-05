const mongoose = require('mongoose');

const BENEFIT_LIMITS = {
  ticket_discount_percent: { min: 0, max: 100 },
  fnb_discount_percent: { min: 0, max: 100 },
  free_tickets: { min: 0, max: 100, integer: true },
  free_ticket_max_value: { min: 0, nullable: true },
  priority_booking_hours: { min: 0, max: 720 },
  points_multiplier: { min: 1, max: 10 },
};

const DEFAULT_BENEFITS = {
  ticket_discount_percent: 0,
  fnb_discount_percent: 0,
  free_tickets: 0,
  free_ticket_max_value: null,
  priority_booking_hours: 0,
  points_multiplier: 1,
};

const benefitsSchema = new mongoose.Schema(
  {
    ticket_discount_percent: { type: Number, default: 0, min: 0, max: 100 },
    fnb_discount_percent: { type: Number, default: 0, min: 0, max: 100 },
    free_tickets: { type: Number, default: 0, min: 0, max: 100 },
    free_ticket_max_value: { type: Number, default: null, min: 0 },
    priority_booking_hours: { type: Number, default: 0, min: 0, max: 720 },
    points_multiplier: { type: Number, default: 1, min: 1, max: 10 },
  },
  { _id: false },
);

module.exports = { benefitsSchema, BENEFIT_LIMITS, DEFAULT_BENEFITS };
